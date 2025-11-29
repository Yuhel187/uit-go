#!/bin/bash

echo "🚀 Dang tao 5,000 tai xe..."
start_time=$(date +%s)

# Hàm gửi request (chạy ngầm)
create_driver() {
  local id=$1
  # Random tọa độ quanh Bến Thành (10.77, 106.69)
  local lat=$(awk -v min=10.750 -v max=10.800 'BEGIN{srand(); print min+rand()*(max-min)}')
  local lng=$(awk -v min=106.650 -v max=106.750 'BEGIN{srand(); print min+rand()*(max-min)}')

  # Gọi vào localhost port 3001 (Driver Service)
  curl -s -o /dev/null -X PUT \
    -H "Content-Type: application/json" \
    -d "{\"lat\": $lat, \"lng\": $lng, \"status\": \"ONLINE\"}" \
    http://localhost:3001/drivers/$id/location
}

# Chạy song song 50 luồng để seed cho nhanh
for ((i=10000;i<15000;i++)); do
   create_driver $i &
   
   # Cứ 50 request thì đợi một chút để không bị quá tải CPU
   if (( $i % 50 == 0 )); then
      wait 
      echo "Done $i / 15000"
   fi
done

wait
echo "✅ HOAN TAT! Da co 5,000 tai xe trong Redis."
