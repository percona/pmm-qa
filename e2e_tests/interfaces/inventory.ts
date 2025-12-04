export interface GetServices {
  services: GetService[];
}

export enum ServiceType {
  mysql = 'mysql',
  postgresql = 'postgresql',
  valkey = 'valkey',
}

export enum AgentStatus {
  running = 'AGENT_STATUS_RUNNING',
}

export interface GetService {
  service_id: string;
  service_type: string;
  service_name: string;
  database_name: string;
  node_id: string;
  node_name: string;
  environment: string;
  cluster: string;
  replication_set: string;
  custom_labels: {
    additionalProp1: string;
    additionalProp2: string;
    additionalProp3: string;
  };
  external_group: string;
  address: string;
  port: 0;
  socket: string;
  created_at: string;
  updated_at: string;
  agents: [
    {
      agent_id: string;
      is_agent_password_set: true;
      agent_type: string;
      aws_access_key: string;
      is_aws_secret_key_set: true;
      azure_options: {
        client_id: string;
        is_client_secret_set: true;
        resource_group: string;
        subscription_id: string;
        tenant_id: string;
      };
      created_at: string;
      custom_labels: {
        additionalProp1: string;
        additionalProp2: string;
        additionalProp3: string;
      };
      disabled: true;
      disabled_collectors: [string];
      listen_port: 0;
      log_level: string;
      max_query_length: 0;
      max_query_log_size: string;
      metrics_path: string;
      metrics_scheme: string;
      mongo_db_options: {
        is_tls_certificate_key_set: true;
        is_tls_certificate_key_file_password_set: true;
        authentication_mechanism: string;
        authentication_database: string;
        stats_collections: [string];
        collections_limit: 0;
        enable_all_collectors: true;
      };
      mysql_options: {
        is_tls_key_set: true;
        extra_dsn_params: {
          additionalProp1: string;
          additionalProp2: string;
          additionalProp3: string;
        };
      };
      node_id: string;
      is_password_set: true;
      pmm_agent_id: string;
      postgresql_options: {
        is_ssl_key_set: true;
        auto_discovery_limit: 0;
        max_exporter_connections: 0;
      };
      process_exec_path: string;
      push_metrics: true;
      query_examples_disabled: true;
      comments_parsing_disabled: true;
      rds_basic_metrics_disabled: true;
      rds_enhanced_metrics_disabled: true;
      runs_on_node_id: string;
      service_id: string;
      status: string;
      table_count: 0;
      table_count_tablestats_group_limit: 0;
      tls: true;
      tls_skip_verify: true;
      username: string;
      updated_at: string;
      version: string;
      is_connected: true;
      expose_exporter: true;
    },
  ];
  status: string;
  version: string;
}
