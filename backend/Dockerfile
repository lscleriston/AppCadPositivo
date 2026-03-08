# backend/app/Dockerfile
FROM python:3.11

WORKDIR /code
# Copia tudo da pasta atual (app/)
COPY . /code

COPY requirements.txt /code

# Instala as dependências do Python
RUN pip install --no-cache-dir -r requirements.txt

ENV PYTHONPATH=/code

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
