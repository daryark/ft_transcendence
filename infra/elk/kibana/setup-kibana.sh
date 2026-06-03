#!/bin/bash

ES_URL="http://elasticsearch:9200"
KIBANA_URL="http://localhost:5601"
NDJSON_FILE="/tmp/dashboard.ndjson"
ES_AUTH="elastic:${ELASTIC_PASSWORD}"

echo "Waiting for elasticsearch..."
until curl -s -u "$ES_AUTH"  "$ES_URL/_cluster/health" >/dev/null; do
	sleep 5
done

echo "Applying ILM policy..."
curl -sS -u "$ES_AUTH"  -X PUT "$ES_URL/_ilm/policy/nginx-logs-policy" \
	-H "Content-Type: application/json" \
	-d @/tmp/elastic/ilm-policy.json

echo "Applying index template..."
curl -sS -u "$ES_AUTH"  -X PUT "$ES_URL/_index_template/nginx-logs-template" \
	-H "Content-Type: application/json" \
	-d @/tmp/elastic/index-template.json

echo "Registering archiving repo..."
curl -sS -u "$ES_AUTH"  -X PUT "$ES_URL/_snapshot/trans_archive" \
  -H "Content-Type: application/json" \
  -d @/tmp/elastic/snapshot-repo.json

echo "Applying SLM policy..."
curl -sS -u "$ES_AUTH"  -X PUT "$ES_URL/_slm/policy/daily-nginx-logs" \
	-H "Content-Type: application/json" \
	-d @/tmp/elastic/slm-policy.json

echo "Elasticsearch setup is done."

/usr/local/bin/kibana-docker &

echo "Waiting for kibana..."
until curl -s -o /dev/null -w "%{http_code}" "$KIBANA_URL/api/status" | grep -q "200"; do
	sleep 5
done
echo "Kibana is ready!"

curl -X POST "$KIBANA_URL/api/saved_objects/_import?overwrite=true" \
	-H "kbn-xsrf: true" \
	-H "Content-Type: multipart/form-data" \
 	--form file=@"$NDJSON_FILE"

echo ""
echo "Dashboard imported!"

echo "Setting password for kibana..."
curl -X POST "http://localhost:9200/_security/user/kibana_system/_password" \
  -u "elastic:${ELASTIC_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"${KIBANA_SYSTEM_PASSWORD}\"}"
echo "Password is set"

echo "Creating user for logstash..."
curl -X POST "http://localhost:9200/_security/user/logstash_internal" \
  -u "elastic:${ELASTIC_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "YOUR_LOGSTASH_PASSWORD",
    "roles": ["logstash_writer"],
    "full_name": "Logstash internal user"
  }'
echo "User created"

wait