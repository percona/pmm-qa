# Test Parameters Reference

This comprehensive reference guide covers all parameters, configurations, and options available across PMM-QA workflows.

## 📚 **Overview**

This document provides detailed information about:
- Common workflow parameters
- Service setup configurations
- Version and image specifications
- Test flags and categories
- Environment variables
- Platform and OS options

## 🔧 **Common Workflow Parameters**

### Branch Configuration
```yaml
pmm_ui_tests_branch: "v3"           # PMM UI tests repository branch
pmm_qa_branch: "v3"                 # PMM QA repository branch
qa_integration_branch: "v3"         # QA integration repository branch
package_testing_branch: "v3"        # Package testing branch
```

### Version and Image Parameters
```yaml
# Server Configuration
pmm_server_image: "perconalab/pmm-server:3-dev-latest"
pmm_server_version: "perconalab/pmm-server:3-dev-latest"
pmm_server_start_version: "latest"

# Client Configuration
pmm_client_image: "perconalab/pmm-client:3-dev-latest"
pmm_client_version: "3-dev-latest"
pmm_client_start_version: "pmm2-latest"
pmm_client_tarball: ""              # Custom tarball URL

# Status Reporting
sha: "null"                         # Commit SHA for status reporting
```

## 🗄️ **Database Service Setup**

### Single Database Configurations
```yaml
# MySQL Family
--database mysql                    # MySQL (latest)
--database mysql=8.0               # MySQL 8.0
--database ps                      # Percona Server (latest)
--database ps=5.7                  # Percona Server 5.7
--database ps=8.0                  # Percona Server 8.0

# PostgreSQL Family
--database pdpgsql                 # Percona Distribution for PostgreSQL (latest)
--database pdpgsql=14              # PostgreSQL 14
--database pdpgsql=15              # PostgreSQL 15
--database pdpgsql=16              # PostgreSQL 16

# MongoDB Family
--database psmdb                   # Percona Server for MongoDB
--database modb                    # MongoDB

# Proxy/Load Balancers
--database haproxy                 # HAProxy
--database proxysql                # ProxySQL

# Special Configurations
--database external                # External exporter testing
--database dockerclients           # Docker client testing
```

### Advanced Database Options
```yaml
# MongoDB with SSL
--database psmdb,SETUP_TYPE=pss

# MongoDB with extra profiles
--database psmdb,COMPOSE_PROFILES=extra

# MySQL/PS with slow query log
--database ps,QUERY_SOURCE=slowlog
--database mysql,QUERY_SOURCE=slowlog

# PostgreSQL with extensions
--database pdpgsql,EXTENSION=pg_stat_monitor
--database pdpgsql,EXTENSION=pg_stat_statements
```

### Multi-Database Setups
```yaml
# Basic multi-database
--database ps --database psmdb --database pdpgsql

# Comprehensive setup
--database ps=8.0 --database psmdb --database pdpgsql=15 --database haproxy

# Client addition patterns
--addclient=ps,1                   # Add 1 Percona Server client
--addclient=pdpgsql,1             # Add 1 PostgreSQL client
--addclient=modb,1                # Add 1 MongoDB client
```

## 🏷️ **Test Tags and Categories**

### E2E Test Tags
```yaml
# Core Functionality
@portal                            # Portal functionality
@inventory                         # Inventory management
@dashboards                        # Dashboard functionality
@qan                              # Query Analytics

# Feature-Specific
@backup-management                 # Backup features
@alerting                         # Alerting functionality
@rbac                             # Role-based access control
@settings-fb                      # Settings feature build tests

# Security and Authentication
@security                         # Security features
@user-password                    # User authentication testing
@oauth                            # OAuth integration

# API and Integration
@api                              # API testing
@exporters                        # Exporter functionality
@mongodb-exporter                 # MongoDB-specific exporters
```

### Feature Build Test Tags
```yaml
# Backup Management
@bm-mongo                         # MongoDB backup tests
@bm-mysql                         # MySQL backup tests
@bm-common                        # Common backup features
@bm-locations                     # Backup location testing

# Database-Specific
@pgsm-pmm-integration            # PostgreSQL pg_stat_monitor
@pgss-pmm-integration            # PostgreSQL pg_stat_statements

# UI Components
@fb-instances                     # Instance management UI
@fb-alerting                      # Alerting UI components
@fb-settings                      # Settings UI components
```

### Upgrade Test Tags
```yaml
# Pre-upgrade Tests
@config-pre-upgrade              # Configuration documentation
@rbac-pre-upgrade               # RBAC state capture
@portal-pre-upgrade             # Portal state capture
@inventory-pre-upgrade          # Inventory state capture

# Post-upgrade Tests
@config-post-upgrade            # Configuration validation
@rbac-post-upgrade             # RBAC validation
@portal-post-upgrade           # Portal validation
@inventory-post-upgrade        # Inventory validation
```

## 📦 **Package Testing Parameters**

### Package Types
```yaml
package: "original"               # Legacy PMM package
package: "pmm3-client"           # PMM3 client package
package: "tools"                 # PMM tools package
```

### Repository Types
```yaml
repository: "release"            # Stable release repository
repository: "release candidate"  # RC repository
repository: "dev-latest"         # Development repository
```

### Metrics Modes
```yaml
metrics_mode: "auto"             # Automatic mode selection
metrics_mode: "push"             # Client pushes metrics
metrics_mode: "pull"             # Server pulls metrics
```

### Installation Scenarios
```yaml
# Playbook Types
playbook: "pmm3-client_integration"
playbook: "pmm3-client_integration_custom_path"
playbook: "pmm3-client_integration_custom_port"
```

## ⬆️ **Upgrade Testing Parameters**

### Upgrade Methods
```yaml
upgrade_type: "UI way"           # Web interface upgrade
upgrade_type: "Docker way"       # Container replacement
upgrade_type: "Podman way"       # Podman-based upgrade
```

### Version Specifications
```yaml
# Start Versions
pmm_server_start_version: "latest"        # Latest stable
pmm_server_start_version: "dev-latest"    # Development
pmm_server_start_version: "2.41.0"        # Specific version
pmm_server_start_version: "3.0.0-rc"      # Release candidate

# Target Repositories
repository: "release"                      # To stable release
repository: "release candidate"            # To RC
repository: "dev-latest"                   # To development
```

## 🖥️ **Platform and OS Parameters**

### Supported Operating Systems
```yaml
# Debian/Ubuntu Family
"bullseye"                       # Debian 11
"bookworm"                       # Debian 12
"jammy"                          # Ubuntu 22.04 LTS
"noble"                          # Ubuntu 24.04 LTS

# Red Hat Family
"ol-8"                           # Oracle Linux 8
"ol-9"                           # Oracle Linux 9
"rocky-8"                        # Rocky Linux 8
"rocky-9"                        # Rocky Linux 9
"centos-7"                       # CentOS 7 (legacy)
```

### Architecture Support
```yaml
"x86_64"                         # Intel/AMD 64-bit
"aarch64"                        # ARM 64-bit
```

## 🌐 **Environment Variables**

### Authentication Variables
```yaml
OAUTH_CLIENT_ID                  # OAuth client identifier
OAUTH_CLIENT_SECRET              # OAuth client secret
OAUTH_PMM_CLIENT_ID             # PMM-specific OAuth client ID
OAUTH_PMM_CLIENT_SECRET         # PMM-specific OAuth secret
ADMIN_PASSWORD                   # PMM admin password (default: admin)
```

### External Service Integration
```yaml
MAILOSAUR_API_KEY               # Email testing service
MAILOSAUR_UI_TESTS_SERVER_ID    # UI tests email server
MAILOSAUR_API_TESTS_SERVER_ID   # API tests email server
SERVICENOW_PASSWORD             # ServiceNow integration
ZEPHYR_PMM_API_KEY             # Test management integration
```

### Testing Configuration
```yaml
PMM_BASE_URL                    # PMM server URL (default: https://127.0.0.1)
TIMEOUT                         # Test timeout settings
BROWSER                         # Browser selection
DOCKER_VERSION                  # Docker image version
CLIENT_VERSION                  # Client version
```

### Backup Testing
```yaml
BACKUP_LOCATION_ACCESS_KEY      # Backup storage access key
BACKUP_LOCATION_SECRET_KEY      # Backup storage secret key
```

## 🔧 **CLI Test Specific Parameters**

### Test Execution Parameters
```yaml
cli_test: "help.spec.ts"                    # Specific test file
cli_test: "pmm-server-only"                 # Server-only tests
cli_test: "pmm-client-docker"               # Client container tests
cli_test: "generic unregister --workers=1"  # Generic tests with workers
cli_test: "postgreSql --workers=1"          # PostgreSQL tests
```

### Service List Parameters
```yaml
services_list: "--database ps=8.0"
services_list: "--database dockerclients"
services_list: "--addclient=ps,1 --addclient=pdpgsql,1"
```

## 🏗️ **Infrastructure Testing Parameters**

### Kubernetes/Helm Parameters
```yaml
server_image: "perconalab/pmm-server:3-dev-latest"
client_image: "perconalab/pmm-client:3-dev-latest"
pmm_qa_branch: "v3"
```

### Easy Install Parameters
```yaml
easy_install_branch: "v3"        # Installation script branch
os: "ubuntu-noble"               # Target operating system
os: "ol-9"                       # Oracle Linux 9
os: "rocky-9"                    # Rocky Linux 9
```

## 📊 **Matrix Testing Parameters**

### Version Matrix
```yaml
matrix_range: "10"               # Number of versions to test
version_matrix: ["3.0.0", "3.1.0", "3.2.0"]
pt_os_matrix: "[\"bullseye\", \"bookworm\", \"noble\"]"
```

### Platform Matrix
```yaml
[
  { os: "ubuntu-noble", package: "pmm3-client", metrics: "auto" },
  { os: "debian-bookworm", package: "pmm3-client", metrics: "push" },
  { os: "ol-9", package: "pmm3-client", metrics: "pull" }
]
```

## 🕒 **Timing and Duration Parameters**

### Test Timeouts
```yaml
timeout-minutes: 40              # Job timeout (Integration tests)
timeout-minutes: 60              # Job timeout (E2E tests)
timeout-minutes: 1               # Job timeout (Version getter)
```

### Expected Durations
```yaml
Help Tests: 5 minutes
Server Container: 10 minutes
Database Tests: 20-30 minutes
E2E Portal: 30 minutes
E2E Inventory: 25 minutes
Package Installation: 20 minutes
Helm Tests: 30 minutes
Upgrade Tests: 45-60 minutes
```

## 🔄 **Special Configuration Patterns**

### Setup Enhancement Flags
```yaml
--setup-portal-oauth             # OAuth configuration for portal
--enable-portal-features         # Portal-specific features
--enable-service-discovery       # Automatic service discovery
--setup-multiple-clients         # Multiple client instances
--enable-backup-management       # Backup functionality
--setup-alerting                 # Alerting configuration
--mongo-replica-for-backup       # MongoDB replica for backup testing
--setup-bm-mysql                 # Backup management for MySQL
```

### Custom Configuration Examples
```yaml
# Comprehensive test setup
--database ps=8.0,QUERY_SOURCE=slowlog \
--database psmdb,SETUP_TYPE=pss,COMPOSE_PROFILES=extra \
--database pdpgsql=15,EXTENSION=pg_stat_monitor \
--database haproxy \
--enable-backup-management \
--setup-alerting \
--create-test-users

# Minimal test setup
--database ps

# Multi-service basic setup
--database ps --database psmdb --database pdpgsql
```

---

**Related Documentation**:
- [Integration & CLI Tests](integration-cli-tests.md)
- [E2E Tests](e2e-tests.md)
- [Package Tests](package-tests.md)
- [Troubleshooting Guide](troubleshooting.md) 