# The KDC both PSMDB compose stacks run as kerberos/local. Built by
# build_kerberos_image in lib/images.sh, or by compose from this folder.
FROM alpine

RUN apk add --no-cache bash krb5 krb5-server krb5-pkinit
COPY configure_krb5.sh /var/lib/krb5kdc/

EXPOSE 88/udp
ENTRYPOINT [ "sh", "/var/lib/krb5kdc/configure_krb5.sh"]
