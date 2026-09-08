export default class Credentials {
  aws = {
    accessKey: process.env.PMM_QA_AWS_ACCESS_KEY_ID ?? '',
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
  rdsMysql84 = {
    address: process.env.PMM_QA_MYSQL_RDS_8_4_HOST ?? '',
    password: process.env.PMM_QA_MYSQL_RDS_8_4_PASSWORD ?? '',
    username: process.env.PMM_QA_MYSQL_RDS_8_4_USER ?? '',
  };
}
