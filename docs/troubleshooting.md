# Troubleshooting Guide

This guide provides solutions for common issues encountered when running PMM-QA tests, debugging workflows, and resolving test failures.

## 🔍 **Overview**

This troubleshooting guide covers:
- Common workflow issues and solutions
- Test failure debugging strategies
- Infrastructure and environment problems
- Performance and timeout issues
- Access and permission problems

## 🚨 **Common Workflow Issues**

### Permission and Access Issues

#### Workflow Permission Denied
```yaml
Issue: Cannot trigger GitHub Actions workflow
Error: "Permission denied" or workflow not visible

Solutions:
✅ Verify repository access permissions
✅ Ensure "Actions: Write" permission
✅ Check organization/repository settings
✅ Validate user account status
✅ Review branch protection rules
```

#### Secret Access Issues
```yaml
Issue: Workflow fails due to missing secrets
Error: "Secret not found" or authentication failures

Solutions:
✅ Verify secrets are configured in repository settings
✅ Check secret names match workflow requirements
✅ Ensure secrets are available to the branch
✅ Validate secret values are correct
✅ Review organization-level secret settings
```

### Version and Image Issues

#### Image Not Found
```yaml
Issue: Docker image pull failures
Error: "Image not found" or "Pull access denied"

Solutions:
✅ Verify image name and tag are correct
✅ Check image exists in registry
✅ Validate registry access permissions
✅ Try alternative image tags
✅ Check network connectivity to registry

Example Fix:
# Instead of non-existent version
pmm_server_image: "perconalab/pmm-server:3.1.0"
# Use available version
pmm_server_image: "perconalab/pmm-server:3-dev-latest"
```

#### Version Compatibility Issues
```yaml
Issue: "Upgrade to the same version is forbidden!"
Error: Start and target versions are identical

Solutions:
✅ Choose different start/target version combinations
✅ Verify version strings are different
✅ Check version detection logic
✅ Use explicit version numbers instead of aliases

Example Fix:
# Problematic configuration
pmm_server_start_version: "latest"
repository: "release"
# Fixed configuration
pmm_server_start_version: "latest"
repository: "dev-latest"
```

## ⏱️ **Timeout and Performance Issues**

### Test Timeouts

#### General Test Timeouts
```yaml
Issue: Tests timing out after 40 minutes
Common Causes:
- Infrastructure setup delays
- Network connectivity issues
- Resource constraints
- Database startup problems

Solutions:
✅ Check PMM server startup logs
✅ Verify database container health
✅ Review network connectivity
✅ Monitor resource usage
✅ Check for stuck processes

Debugging Commands:
docker ps -a                    # Check container status
docker logs pmm-server          # Review server logs
kubectl get pods               # Check K8s pod status (for Helm tests)
```

#### Database Setup Timeouts
```yaml
Issue: Database service setup takes too long
Common Causes:
- Image download delays
- Container resource constraints
- Network connectivity issues
- Database initialization problems

Solutions:
✅ Check container image availability
✅ Verify adequate system resources
✅ Review database startup logs
✅ Check network connectivity
✅ Validate database configuration

Monitoring Commands:
docker stats                   # Monitor resource usage
docker logs <container>        # Check container logs
netstat -tuln                 # Check port availability
```

### Performance Degradation

#### Slow Test Execution
```yaml
Issue: Tests running slower than expected
Common Causes:
- Resource contention
- Network latency
- Database performance issues
- UI rendering delays

Solutions:
✅ Monitor system resources
✅ Check for concurrent test runs
✅ Optimize database configurations
✅ Review network connectivity
✅ Check browser/UI performance

Performance Monitoring:
top                           # System resource usage
iotop                         # Disk I/O monitoring
nethogs                       # Network usage per process
```

## 🗄️ **Database and Service Issues**

### Database Connection Failures

#### Service Setup Failures
```yaml
Issue: Database service fails to start
Common Causes:
- Port conflicts
- Configuration errors
- Resource constraints
- Image compatibility issues

Solutions:
✅ Check port availability
✅ Verify container health status
✅ Review database credentials
✅ Check resource limits
✅ Validate image compatibility

Debugging Steps:
1. Check container status: docker ps -a
2. Review container logs: docker logs <container_name>
3. Verify port availability: netstat -tuln | grep <port>
4. Check resource usage: docker stats
5. Test connectivity: telnet <host> <port>
```

#### Metrics Collection Issues
```yaml
Issue: Metrics not being collected
Common Causes:
- Service registration failures
- Network connectivity issues
- Authentication problems
- Exporter configuration errors

Solutions:
✅ Verify service registration
✅ Check exporter configuration
✅ Review database permissions
✅ Validate metrics endpoints
✅ Check authentication credentials

Verification Commands:
curl http://localhost:9090/metrics    # Check metrics endpoint
pmm inventory list                    # Verify service registration
pmm status                           # Check client status
```

### MongoDB-Specific Issues

#### Replica Set Configuration
```yaml
Issue: MongoDB replica set setup fails
Common Causes:
- Network configuration issues
- Timing problems in initialization
- Resource constraints
- Authentication issues

Solutions:
✅ Check replica set configuration
✅ Verify network connectivity between nodes
✅ Review MongoDB logs
✅ Check authentication setup
✅ Validate resource allocation

MongoDB Debugging:
mongo --eval "rs.status()"          # Check replica set status
mongo --eval "db.stats()"           # Check database status
docker exec mongo mongo --eval "rs.initiate()"  # Initialize replica set
```

### PostgreSQL-Specific Issues

#### Extension Loading Issues
```yaml
Issue: pg_stat_monitor or pg_stat_statements not working
Common Causes:
- Extension not installed
- Configuration not updated
- PostgreSQL restart required
- Permission issues

Solutions:
✅ Install required extensions
✅ Update postgresql.conf
✅ Restart PostgreSQL service
✅ Check extension permissions
✅ Verify extension functionality

PostgreSQL Debugging:
psql -c "SELECT * FROM pg_extension;"  # List installed extensions
psql -c "SHOW shared_preload_libraries;"  # Check loaded libraries
psql -c "SELECT * FROM pg_stat_statements LIMIT 1;"  # Test extension
```

## 🎭 **UI and Browser Issues**

### Browser-Related Failures

#### Element Not Found Errors
```yaml
Issue: UI tests fail with "Element not found"
Common Causes:
- UI layout changes
- Timing issues (elements not loaded)
- Browser compatibility issues
- Dynamic content loading

Solutions:
✅ Update element selectors
✅ Add explicit waits for elements
✅ Check for dynamic content loading
✅ Verify page layout changes
✅ Test with different browsers

Playwright Debugging:
npx playwright test --headed        # Run with visible browser
npx playwright test --debug         # Run in debug mode
npx playwright codegen             # Generate selectors
```

#### Authentication Issues
```yaml
Issue: Login failures in UI tests
Common Causes:
- Incorrect credentials
- OAuth configuration issues
- Session management problems
- Authentication flow changes

Solutions:
✅ Verify login credentials
✅ Check OAuth configuration
✅ Review session management
✅ Validate authentication flow
✅ Check for CAPTCHA or 2FA

Authentication Debugging:
# Check PMM server authentication
curl -k https://localhost/v1/auth/login \
  -d '{"username":"admin","password":"admin"}'

# Verify OAuth configuration
echo $OAUTH_CLIENT_ID
echo $OAUTH_CLIENT_SECRET
```

### Page Load Issues

#### Slow Page Loading
```yaml
Issue: Pages load slowly or timeout
Common Causes:
- Server performance issues
- Network latency
- Large data sets
- JavaScript execution problems

Solutions:
✅ Increase timeout settings
✅ Check server performance
✅ Optimize data queries
✅ Review JavaScript errors
✅ Monitor network requests

Performance Debugging:
# Browser developer tools
1. Open F12 developer tools
2. Go to Network tab
3. Monitor request timing
4. Check for slow requests
5. Review JavaScript console for errors
```

## 🏗️ **Infrastructure Issues**

### Kubernetes/Helm Issues

#### Minikube Startup Failures
```yaml
Issue: Minikube fails to start
Common Causes:
- Insufficient system resources
- Virtualization not enabled
- Network configuration issues
- Driver compatibility problems

Solutions:
✅ Check system resources (CPU, memory)
✅ Enable virtualization in BIOS
✅ Update Minikube version
✅ Try different drivers
✅ Clear Minikube cache

Minikube Debugging:
minikube status                     # Check cluster status
minikube logs                       # View cluster logs
minikube delete && minikube start   # Reset cluster
minikube config view                # Check configuration
```

#### Storage Driver Issues
```yaml
Issue: CSI storage driver installation fails
Common Causes:
- Kubernetes version incompatibility
- Insufficient permissions
- Resource constraints
- Driver configuration errors

Solutions:
✅ Check Kubernetes version compatibility
✅ Verify cluster permissions
✅ Review driver installation logs
✅ Check resource availability
✅ Validate storage class configuration

Storage Debugging:
kubectl get pods -n kube-system     # Check system pods
kubectl get storageclass           # List storage classes
kubectl describe pv                # Check persistent volumes
kubectl logs -n kube-system <csi-pod>  # Check CSI driver logs
```

### Container Issues

#### Docker Daemon Issues
```yaml
Issue: Docker operations fail
Common Causes:
- Docker daemon not running
- Permission issues
- Disk space problems
- Network configuration issues

Solutions:
✅ Start Docker daemon
✅ Add user to docker group
✅ Free up disk space
✅ Check Docker configuration
✅ Restart Docker service

Docker Debugging:
systemctl status docker            # Check daemon status
docker system df                   # Check disk usage
docker system prune               # Clean up space
docker info                       # Check Docker info
```

## 📦 **Package Installation Issues**

### Repository Configuration

#### Package Not Found
```yaml
Issue: Package installation fails with "not found"
Common Causes:
- Repository not configured
- Package version unavailable
- Repository URL incorrect
- GPG key issues

Solutions:
✅ Configure package repository
✅ Update package cache
✅ Verify package version exists
✅ Check repository URL
✅ Import GPG keys

APT Debugging:
apt update                         # Update package cache
apt search pmm                     # Search for packages
apt-cache policy pmm3-client      # Check available versions
apt-key list                       # List GPG keys
```

#### Permission Issues
```yaml
Issue: Package installation fails with permission errors
Common Causes:
- Insufficient privileges
- SELinux/AppArmor restrictions
- File system permissions
- User account limitations

Solutions:
✅ Run with sudo/root privileges
✅ Check SELinux/AppArmor settings
✅ Verify file system permissions
✅ Review user account capabilities
✅ Check package manager configuration

Permission Debugging:
sudo -l                           # Check sudo permissions
getenforce                        # Check SELinux status
aa-status                         # Check AppArmor status
ls -la /etc/apt/sources.list.d/   # Check repository files
```

## 🔄 **Network and Connectivity Issues**

### Network Configuration

#### Connectivity Problems
```yaml
Issue: Network connectivity failures
Common Causes:
- Firewall blocking connections
- DNS resolution issues
- Proxy configuration problems
- Network routing issues

Solutions:
✅ Check firewall settings
✅ Verify DNS resolution
✅ Configure proxy settings
✅ Test network connectivity
✅ Review routing tables

Network Debugging:
ping google.com                    # Test internet connectivity
nslookup pmm-server               # Test DNS resolution
telnet <host> <port>              # Test port connectivity
curl -I https://github.com        # Test HTTPS connectivity
netstat -rn                       # Check routing table
```

#### Port Conflicts
```yaml
Issue: Services fail to start due to port conflicts
Common Causes:
- Ports already in use
- Multiple service instances
- System services using ports
- Previous test cleanup incomplete

Solutions:
✅ Check port availability
✅ Stop conflicting services
✅ Use alternative ports
✅ Complete cleanup from previous tests
✅ Configure port forwarding

Port Debugging:
netstat -tuln | grep :80          # Check port 80 usage
lsof -i :3306                     # Check MySQL port usage
ss -tuln                          # Modern netstat alternative
fuser 9090/tcp                    # Find process using port
```

## 🔧 **Debugging Strategies**

### Log Analysis

#### Collecting Logs
```yaml
Workflow Logs:
1. Go to GitHub Actions tab
2. Click on failed workflow run
3. Expand failed job steps
4. Copy/download log content

Container Logs:
docker logs pmm-server            # PMM server logs
docker logs pmm-client            # PMM client logs
kubectl logs <pod-name>           # Kubernetes pod logs

Application Logs:
tail -f /var/log/pmm/*.log        # PMM application logs
journalctl -u pmm-agent           # Systemd service logs
```

#### Log Analysis Techniques
```yaml
Common Log Patterns to Look For:
- "ERROR" or "FATAL" messages
- "Connection refused" or "timeout" errors
- "Permission denied" messages
- "Out of memory" or resource errors
- HTTP error codes (4xx, 5xx)

Useful Commands:
grep -i error /var/log/pmm/*      # Find error messages
journalctl -f                     # Follow system logs
dmesg | tail                      # Check kernel messages
```

### Test Isolation

#### Reproducing Issues Locally
```yaml
Steps to Reproduce:
1. Use same parameters as failed workflow
2. Set up identical environment
3. Run tests step by step
4. Monitor logs and resources
5. Identify failure point

Local Testing Commands:
# Set up local environment
docker-compose up -d

# Run specific test
npx playwright test <test-name>

# Run with debugging
npx playwright test --headed --debug
```

## 📞 **Getting Help**

### Information to Collect
```yaml
When Reporting Issues:
✅ Workflow name and run ID
✅ Complete error messages
✅ Configuration parameters used
✅ Environment details
✅ Steps to reproduce
✅ Expected vs actual behavior
```

### Escalation Process
```yaml
1. Check this troubleshooting guide
2. Search existing GitHub issues
3. Review workflow logs thoroughly
4. Try reproducing locally
5. Create detailed issue report
6. Contact PMM QA team if needed
```

### Useful Resources
```yaml
Documentation:
- PMM Documentation: https://docs.percona.com/pmm/
- Playwright Docs: https://playwright.dev/
- Docker Docs: https://docs.docker.com/
- Kubernetes Docs: https://kubernetes.io/docs/

Community:
- PMM GitHub Issues
- Percona Community Forums
- PMM QA Team Channels
```

---

**Related Documentation**:
- [Integration & CLI Tests](integration-cli-tests.md)
- [E2E Tests](e2e-tests.md)
- [Test Parameters Reference](test-parameters.md)
- [Main Documentation](README.md) 