FROM php:7.4-alpine

RUN set -ex \
	&& apk --no-cache add postgresql-libs postgresql-dev \
	&& docker-php-ext-install pgsql pdo_pgsql \
	&& docker-php-ext-install mysqli && docker-php-ext-enable mysqli \
	&& apk del postgresql-dev

RUN apk --update add --virtual build-dependencies build-base openssl-dev autoconf \
  && pecl install mongodb \
  && docker-php-ext-enable mongodb \
  && apk del build-dependencies build-base openssl-dev autoconf \
  && rm -rf /var/cache/apk/*

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/bin/ --filename=composer
RUN composer require mongodb/mongodb
