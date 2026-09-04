#!/usr/bin/env bash

PMM_SERVER_HOST=${1}
PMM_SERVER_PASSWORD=${2}
CLIENT_VERSION=${3}
INSTANCES=${4}
METRICS_MODE=${5}
DBTYPE=${6}
ENABLEALLMONGO=${7}

if [[ $DBTYPE == mysql ]]; then 
	for i in `seq 1 ${INSTANCES}`; do
		linode-cli linodes create --type g6-standard-2 --image linode/ubuntu22.04 --label sp_fb_${i}_${DBTYPE}_${METRICS_MODE}_test --stackscript_id 1611994 --stackscript_data '{"hostname": "'"li_client_mysql_${METRICS_MODE}_${i}"'", 
		"pmmserver": "'"${PMM_SERVER_HOST}"'", "pmmpassword": "'"${PMM_SERVER_PASSWORD}"'", 
		"clientversion": "'"${CLIENT_VERSION}"'", "metricsmode": "'"${METRICS_MODE}"'"}' --root_pass 00bf23c3eb595e98e44fe0872ddb50b7f --region us-east --authorized_keys "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDsvdKkZBUUfiaMbezq1DaVS/ifeAvMNBjhwcFs5kCGFpCB7wvWljvrAvOaqXHF0wo0uqvh/lK8y5yDvu8CeYyI9czpZ66T3+SkZ7wXf+h2qOtxabhPsKxmPaWRdbJQMsPLcorUKsLXh1URZyYXpzaoefmnknUO0fWDc4a/gIGYAnyYMfZoUFZ9T2cr4wCNi5Z7bzWH9nDEUeuHGoYaxHJhWJ4FDWdSqq6OjP5ck2U4Kf+hmBfMBxKSd0v8f6ABRjZ9wuuyz53lo1RMy3rZ+J2S/6fr2MNZPftQzOK6znZ6MERMyExZjuX6a2igoAUz/5Pms/Js2DAOYD98hssw+ijpRBybrXXW1NjWPqP94nvgSM+rm0uSDtNSQ3gONZOsIFwYoaZYZwu3DOnd1l/YkUnCD/hOZfXNJYhN9lfjZVIwMFHPlgiX6X0YoXxkgLMArRXEDiBwElbuJ5TAVSaaIO29S9H3KKHOTJKGHjzQLx8Ysa9b3En6FYpfKT6RzHvpmGL+o5Cb7Vma/peBO1V4qVkG4JZM8+TQ1jktjCqE7mSw9UQir8btzE7KdCl6rb86d6I4P3f1aPJyVXcYPrdv36yXYr/7YneBFsBcp0uWT+TlLUg/14JGdW0ZUNsU8auIlPNSMkHrvrrVweMeCqmdU67NgvlKKc5lFPljMRRkxMHzJQ== shruti@Shrutis-MacBook-Pro.local"
  sleep 15
	done
fi

if [[ $DBTYPE == postgresql ]]; then
	for i in `seq 1 ${INSTANCES}`; do
		linode-cli linodes create --type g6-standard-2 --image linode/ubuntu22.04 --label sp_fb_${i}_${DBTYPE}_${METRICS_MODE}_test --stackscript_id 1612038 --stackscript_data '{"hostname": "'"li_client_pgsql_${METRICS_MODE}_${i}"'", 
		"pmmserver": "'"${PMM_SERVER_HOST}"'", "pmmpassword": "'"${PMM_SERVER_PASSWORD}"'", 
        "clientversion": "'"${CLIENT_VERSION}"'", "metricsmode": "'"${METRICS_MODE}"'"}' --root_pass 00bf23c3eb595e98e44fe0872ddb50b7f --region us-east --authorized_keys "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDsvdKkZBUUfiaMbezq1DaVS/ifeAvMNBjhwcFs5kCGFpCB7wvWljvrAvOaqXHF0wo0uqvh/lK8y5yDvu8CeYyI9czpZ66T3+SkZ7wXf+h2qOtxabhPsKxmPaWRdbJQMsPLcorUKsLXh1URZyYXpzaoefmnknUO0fWDc4a/gIGYAnyYMfZoUFZ9T2cr4wCNi5Z7bzWH9nDEUeuHGoYaxHJhWJ4FDWdSqq6OjP5ck2U4Kf+hmBfMBxKSd0v8f6ABRjZ9wuuyz53lo1RMy3rZ+J2S/6fr2MNZPftQzOK6znZ6MERMyExZjuX6a2igoAUz/5Pms/Js2DAOYD98hssw+ijpRBybrXXW1NjWPqP94nvgSM+rm0uSDtNSQ3gONZOsIFwYoaZYZwu3DOnd1l/YkUnCD/hOZfXNJYhN9lfjZVIwMFHPlgiX6X0YoXxkgLMArRXEDiBwElbuJ5TAVSaaIO29S9H3KKHOTJKGHjzQLx8Ysa9b3En6FYpfKT6RzHvpmGL+o5Cb7Vma/peBO1V4qVkG4JZM8+TQ1jktjCqE7mSw9UQir8btzE7KdCl6rb86d6I4P3f1aPJyVXcYPrdv36yXYr/7YneBFsBcp0uWT+TlLUg/14JGdW0ZUNsU8auIlPNSMkHrvrrVweMeCqmdU67NgvlKKc5lFPljMRRkxMHzJQ== shruti@Shrutis-MacBook-Pro.local"		
sleep 15
	done
fi

if [[ $DBTYPE == mongodb ]]; then 
	for i in `seq 1 ${INSTANCES}`; do
		linode-cli linodes create --type g6-standard-2 --image linode/ubuntu22.04 --label sp_fb_${i}_${DBTYPE}_${METRICS_MODE}_test_1 --stackscript_id 2046257 --stackscript_data '{"hostname": "'"li_client_mongodb_${METRICS_MODE}_${i}"'", 
		"pmmserver": "'"${PMM_SERVER_HOST}"'", "pmmpassword": "'"${PMM_SERVER_PASSWORD}"'",
                "clientversion": "'"${CLIENT_VERSION}"'", "metricsmode": "'"${METRICS_MODE}"'"}' --root_pass 00bf23c3eb595e98e44fe0872ddb50b7f --region us-east --authorized_keys "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDsvdKkZBUUfiaMbezq1DaVS/ifeAvMNBjhwcFs5kCGFpCB7wvWljvrAvOaqXHF0wo0uqvh/lK8y5yDvu8CeYyI9czpZ66T3+SkZ7wXf+h2qOtxabhPsKxmPaWRdbJQMsPLcorUKsLXh1URZyYXpzaoefmnknUO0fWDc4a/gIGYAnyYMfZoUFZ9T2cr4wCNi5Z7bzWH9nDEUeuHGoYaxHJhWJ4FDWdSqq6OjP5ck2U4Kf+hmBfMBxKSd0v8f6ABRjZ9wuuyz53lo1RMy3rZ+J2S/6fr2MNZPftQzOK6znZ6MERMyExZjuX6a2igoAUz/5Pms/Js2DAOYD98hssw+ijpRBybrXXW1NjWPqP94nvgSM+rm0uSDtNSQ3gONZOsIFwYoaZYZwu3DOnd1l/YkUnCD/hOZfXNJYhN9lfjZVIwMFHPlgiX6X0YoXxkgLMArRXEDiBwElbuJ5TAVSaaIO29S9H3KKHOTJKGHjzQLx8Ysa9b3En6FYpfKT6RzHvpmGL+o5Cb7Vma/peBO1V4qVkG4JZM8+TQ1jktjCqE7mSw9UQir8btzE7KdCl6rb86d6I4P3f1aPJyVXcYPrdv36yXYr/7YneBFsBcp0uWT+TlLUg/14JGdW0ZUNsU8auIlPNSMkHrvrrVweMeCqmdU67NgvlKKc5lFPljMRRkxMHzJQ== shruti@Shrutis-MacBook-Pro.local" 
		sleep 15
	done
fi
