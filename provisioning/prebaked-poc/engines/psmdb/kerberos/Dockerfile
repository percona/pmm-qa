FROM alpine:3.22
RUN apk add --no-cache krb5 krb5-server
COPY configure.sh /usr/local/bin/configure-kdc
RUN chmod +x /usr/local/bin/configure-kdc
EXPOSE 88/tcp 88/udp
ENTRYPOINT ["configure-kdc"]
