import CliHelper from '@helpers/cli.helper';

export default class TlsHelper {
  constructor(private readonly cliHelper: CliHelper) {}

  // A throwaway self-signed certificate and its unencrypted key, in PEM, from the runner's openssl.
  generateSelfSignedCertificate = (commonName = 'pmm-tls-test') => {
    const pem = this.cliHelper
      .execSilent(
        `dir=$(mktemp -d) && openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=${commonName} -keyout $dir/key.pem -out $dir/cert.pem 2>/dev/null && cat $dir/key.pem $dir/cert.pem; rc=$?; rm -rf $dir; exit $rc`,
      )
      .assertSuccess().stdout;

    const block = (label: string) => {
      const match = new RegExp(`-----BEGIN ${label}-----[\\s\\S]+?-----END ${label}-----`).exec(pem);

      if (!match) throw new Error(`openssl output has no ${label}`);

      return match[0];
    };

    return { cert: block('CERTIFICATE'), key: block('PRIVATE KEY') };
  };
}
