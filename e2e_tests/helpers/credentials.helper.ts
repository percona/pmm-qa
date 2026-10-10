export default class Credentials {
  aws = {
    accessKey: process.env.PMM_QA_AWS_ACCESS_KEY_ID ?? '',
    rdsRoleArn: process.env.PMM_QA_AWS_RDS_ROLE_ARN ?? '',
    secretKey: process.env.PMM_QA_AWS_ACCESS_KEY ?? '',
  };
  perconaServer = {
    password: 'GRgrO9301RuF',
    ps_84: {
      password: 'GRgrO9301RuF',
      username: 'root',
    },
    username: 'root',
  };
  postgresContainer = {
    password: 'pmm-^*&@agent-password',
    username: 'postgres',
  };
  rdsMysql84 = {
    address: process.env.PMM_QA_MYSQL_RDS_8_4_HOST ?? '',
    instanceId: 'pmm-qa-rds-mysql-8-4',
    password: process.env.PMM_QA_MYSQL_RDS_8_4_PASSWORD ?? '',
    username: process.env.PMM_QA_MYSQL_RDS_8_4_USER ?? '',
  };
}
