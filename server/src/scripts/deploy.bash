docker build -t ironpeak-api .
docker run -d --name ironpeak-api --env-file .env -p 8000:8000 ironpeak-api