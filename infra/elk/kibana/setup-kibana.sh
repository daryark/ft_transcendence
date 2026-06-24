#!/bin/bash

ES_URL="http://elasticsearch:9200"
KIBANA_URL="http://localhost:5601/kibana"
NDJSON_FILE="/tmp/dashboard.ndjson"
ES_AUTH="elastic:${ELASTIC_PASSWORD}"

echo "Waiting for elasticsearch..."
until curl -s -u "$ES_AUTH"  "$ES_URL/_cluster/health" >/dev/null; do
	sleep 5
done

echo "Setting password for kibana..."
curl -X POST "$ES_URL/_security/user/kibana_system/_password" \
  -u "elastic:${ELASTIC_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"${KIBANA_SYSTEM_PASSWORD}\"}"
echo "Password is set"

echo "Creating logstash role for nginx-logs-*..."
curl -sS -X PUT "$ES_URL/_security/role/logstash_nginx_writer" \
  -u "$ES_AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "cluster": ["monitor", "manage_index_templates", "manage_ilm"],
    "indices": [{
      "names": ["nginx-logs-*"],
      "privileges": ["write", "create", "create_index", "manage", "manage_ilm"]
    }]
  }'

echo "Creating user for logstash..."
curl -sS -X PUT "$ES_URL/_security/user/logstash_internal" \
  -u "$ES_AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"password\": \"${LOGSTASH_INTERNAL_PASSWORD}\",
    \"roles\": [\"logstash_nginx_writer\"],
    \"full_name\": \"Logstash internal user\"
  }"
echo "User created"

echo "Applying ILM policy..."
curl -sS -u "$ES_AUTH" -X PUT "$ES_URL/_ilm/policy/nginx-logs-policy" \
	-H "Content-Type: application/json" \
	-d @/tmp/elastic/ilm-policy.json

echo "Applying index template..."
curl -sS -u "$ES_AUTH" -X PUT "$ES_URL/_index_template/nginx-logs-template" \
	-H "Content-Type: application/json" \
	-d @/tmp/elastic/index-template.json

echo "Registering archiving repo..."
curl -sS -u "$ES_AUTH" -X PUT "$ES_URL/_snapshot/trans_archive" \
  -H "Content-Type: application/json" \
  -d @/tmp/elastic/snapshot-repo.json

echo "Applying SLM policy..."
curl -sS -u "$ES_AUTH" -X PUT "$ES_URL/_slm/policy/daily-nginx-logs" \
	-H "Content-Type: application/json" \
	-d @/tmp/elastic/slm-policy.json

echo "Elasticsearch setup is done."

/usr/local/bin/kibana-docker &

echo "Waiting for kibana..."
until curl -sS -u "$ES_AUTH" -o /dev/null -w "%{http_code}" "$KIBANA_URL/api/status" | grep -q "200"; do
	sleep 5
done
echo "Kibana is ready!"

curl -sS -u "$ES_AUTH" -X POST "$KIBANA_URL/api/saved_objects/_import?overwrite=true" \
	-H "kbn-xsrf: true" \
	-H "Content-Type: multipart/form-data" \
 	--form file=@"$NDJSON_FILE"

echo ""
echo "Dashboard imported!"



wait