# -----------------------------
# Stage 0: install dependencies
# -----------------------------
FROM node:14-bullseye AS base
WORKDIR /usr/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    libsasl2-modules-gssapi-mit \
    nodejs \
    python3 \
    python3-psycopg2 \
    python3-venv \
    python3-dev \
    software-properties-common \
    unixodbc-dev \
    unzip \
    wget \
    && apt-get clean

# dbt
RUN python3 -m venv /usr/local/venv
RUN /usr/local/venv/bin/pip install \
    "dbt-core==1.2.0" \
    "dbt-postgres==1.2.0" \
    "dbt-redshift==1.2.0" \
    "dbt-snowflake==1.2.0" \
    "dbt-bigquery==1.2.0" \
    "dbt-databricks==1.2.0"
ENV PATH $PATH:/usr/local/venv/bin

RUN wget \
    --quiet \
    https://databricks-bi-artifacts.s3.us-east-2.amazonaws.com/simbaspark-drivers/odbc/2.6.19/SimbaSparkODBC-2.6.19.1033-Debian-64bit.zip \
    -O /tmp/databricks_odbc.zip \
    && unzip /tmp/databricks_odbc.zip -d /tmp \
    && dpkg -i /tmp/simbaspark_*.deb \
    && rm -rf /tmp/*


# -----------------------------
# Stage 1: stop here for dev environment
# -----------------------------
FROM base AS dev

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && apt-get clean

EXPOSE 3000
EXPOSE 8080

# -----------------------------
# Stage 2: continue build for production environment
# -----------------------------

FROM base AS prod-builder
# Install development dependencies for all
COPY package.json .
COPY yarn.lock .
COPY packages/common/package.json ./packages/common/
COPY packages/warehouses/package.json ./packages/warehouses/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
RUN yarn install --pure-lockfile --non-interactive

# Build common
COPY packages/common/tsconfig.json ./packages/common/
COPY packages/common/src/ ./packages/common/src/
RUN yarn --cwd ./packages/common/ build

# Build warehouses
COPY packages/warehouses/tsconfig.json ./packages/warehouses/
COPY packages/warehouses/src/ ./packages/warehouses/src/
RUN yarn --cwd ./packages/warehouses/ build

# Build backend
COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/backend/src/ ./packages/backend/src
RUN yarn --cwd ./packages/backend/ build

# Build frontend
COPY packages/frontend ./packages/frontend
RUN yarn --cwd ./packages/frontend/ build

# Cleanup development dependencies
RUN rm -rf packages/*/node_modules

# Install production dependencies
ENV NODE_ENV production
RUN yarn install --pure-lockfile --non-interactive --production

# -----------------------------
# Stage 3: execution environment for backend
# -----------------------------

FROM node:14-bullseye as prod
WORKDIR /usr/app

ENV NODE_ENV production
ENV PATH $PATH:/usr/local/venv/bin

RUN apt-get update && apt-get install -y --no-install-recommends \
    unixodbc-dev \
    python3 \
    python3-psycopg2 \
    python3-venv \
    && apt-get clean

COPY --from=prod-builder /usr/local/venv /usr/local/venv
COPY --from=prod-builder /opt/simba /opt/simba
COPY --from=prod-builder /usr/app /usr/app

# Production config
COPY lightdash.yml /usr/app/lightdash.yml
ENV LIGHTDASH_CONFIG_FILE /usr/app/lightdash.yml

# Run backend
COPY ./docker/prod-entrypoint.sh /usr/bin/prod-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/bin/prod-entrypoint.sh"]
CMD ["yarn", "workspace", "backend", "start"]
