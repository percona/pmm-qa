FROM rockylinux:8

RUN dnf install -y https://repo.percona.com/yum/percona-release-latest.noarch.rpm \
    && percona-release enable-only proxysql release \
    && dnf install -y proxysql2 mysql which \
    && dnf clean all \
    && proxysql --version \
    && command -v mysql proxysql proxysql-admin

COPY proxysql.cnf /etc/proxysql.cnf
COPY proxysql-admin.cnf /etc/proxysql-admin.cnf

EXPOSE 6032 6033
ENTRYPOINT ["proxysql"]
CMD ["-f", "-c", "/etc/proxysql.cnf"]
