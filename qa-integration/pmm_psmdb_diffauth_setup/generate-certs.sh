#Generate certificates for tests
rm -rf easy-rsa pki certs && mkdir certs
git clone https://github.com/OpenVPN/easy-rsa.git
./easy-rsa/easyrsa3/easyrsa init-pki
./easy-rsa/easyrsa3/easyrsa --req-cn=Percona --batch build-ca nopass
./easy-rsa/easyrsa3/easyrsa --req-ou=server --subject-alt-name=DNS:pmm-server --batch build-server-full pmm-server nopass
./easy-rsa/easyrsa3/easyrsa --req-ou=server --subject-alt-name=DNS:psmdb-server --batch build-server-full psmdb-server nopass
./easy-rsa/easyrsa3/easyrsa --req-ou=client --batch build-client-full pmm-test nopass
openssl dhparam -out certs/dhparam.pem 2048

cp pki/ca.crt certs/ca-certs.pem
cp pki/private/pmm-server.key certs/certificate.key
cp pki/issued/pmm-server.crt certs/certificate.crt
cat pki/private/psmdb-server.key pki/issued/psmdb-server.crt > certs/psmdb-server.pem
cat pki/private/pmm-test.key pki/issued/pmm-test.crt > certs/client.pem
find certs -type f -exec chmod 644 {} \;
