#!/bin/bash

ES_URL="http://elasticsearch:9200"
KIBANA_URL="http://localhost:5601"
NDJSON_FILE="/tmp/dashboard.ndjson"

echo "Waiting for elasticsearch..."
until curl -sf "$ES_URL/_cluster/health" >/dev/null; do
	sleep 5
done

echo "Applying ILM policy..."
curl -sf -X PUT "$ES_URL/_ilm/policy/nginx-logs-policy" \
	-H "Content-Type: application/json" \
	-d @/tmp/elastic/ilm-policy.json

echo "Applying index template..."
curl -sf -X PUT "$ES_URL/_index_template/nginx-logs-template" \
	-H "Content-Type: application/json" \
	-d @/tmp/elastic/ilm-template.json

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

wait