#!/bin/bash

set -e

ES_URL="${ES_URL:-http://elasticsearch:9200}"

echo "Waiting for elasticsearch..."
untill curl -sf "$ES_URL/_cluster/health" >/dev/null; do
	sleep 5
done

echo "Applying ILM policy..."
curl -sf -X PUT "$ES_URL/_ilm/policy/nginx-logs-policy" \
	-H "Content-Type: application/json" \
	-d @/setup/ilm-policy.json

echo "Applying index template..."
curl -sf -X PUT "$ES_URL/_index_template/nginx-logs-template" \
	-H "Content-Type: application/json" \
	-d @/setup/ilm-template.json

echo "Elasticsearch setup is done."