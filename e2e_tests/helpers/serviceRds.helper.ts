import { RdsExporter } from '@interfaces/inventory';

export enum RdsAuthMode {
  accessKey = 'access_key',
  hostCredentials = 'host_credentials',
  iamRole = 'iam_role',
}

export interface RdsCredentials {
  awsAccessKey: string;
  awsRoleArn: string;
  isAwsSecretKeySet: boolean;
}

// A CloudWatch metric, which the RDS exporter reports only while its AWS credentials work.
export const rdsCloudWatchMetric = 'aws_rds_database_connections_average';

export const noRdsCredentials: RdsCredentials = {
  awsAccessKey: '',
  awsRoleArn: '',
  isAwsSecretKeySet: false,
};

// The instance endpoint starts with the DB instance identifier.
export const rdsInstanceId = (address: string) => address.split('.')[0];

export const rdsCredentialsState = ({
  aws_access_key,
  aws_role_arn,
  is_aws_secret_key_set,
}: RdsExporter): RdsCredentials => ({
  awsAccessKey: aws_access_key ?? '',
  awsRoleArn: aws_role_arn ?? '',
  isAwsSecretKeySet: !!is_aws_secret_key_set,
});
