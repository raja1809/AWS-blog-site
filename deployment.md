# Deployment Guide

This guide will walk you through deploying the AWS Blog Site to your own AWS infrastructure.

## Prerequisites

- AWS Account with free tier access
- AWS CLI installed and configured
- Node.js 18+ installed locally
- Git installed
- Domain name (optional)

## Phase 1: AWS Account Setup

### 1.1 Create AWS Account
1. Visit [AWS Console](https://aws.amazon.com/)
2. Click "Create AWS Account"
3. Complete the registration process
4. Verify your email and phone number

### 1.2 Configure AWS CLI
```bash
# Install AWS CLI if not already installed
# Follow instructions at: https://aws.amazon.com/cli/

# Configure AWS CLI
aws configure
# Enter your Access Key ID
# Enter your Secret Access Key
# Default region: us-east-1
# Default output format: json
```

## Phase 2: Infrastructure Setup

### 2.1 Create VPC and Networking

**Create VPC:**
1. Go to VPC Console → Create VPC
2. Settings:
   - Name: `blog-vpc`
   - IPv4 CIDR: `10.0.0.0/16`

**Create Subnets:**
1. Public Subnet 1:
   - Name: `blog-public-subnet-1`
   - AZ: us-east-1a
   - CIDR: `10.0.1.0/24`

2. Public Subnet 2:
   - Name: `blog-public-subnet-2`
   - AZ: us-east-1b
   - CIDR: `10.0.2.0/24`

3. Private Subnet 1:
   - Name: `blog-private-subnet-1`
   - AZ: us-east-1a
   - CIDR: `10.0.3.0/24`

4. Private Subnet 2:
   - Name: `blog-private-subnet-2`
   - AZ: us-east-1b
   - CIDR: `10.0.4.0/24`

**Create Internet Gateway:**
1. Name: `blog-igw`
2. Attach to `blog-vpc`

**Create Route Tables:**
1. Public Route Table:
   - Name: `blog-public-rt`
   - Add route: `0.0.0.0/0` → Internet Gateway
   - Associate with public subnets

2. Private Route Table:
   - Name: `blog-private-rt`
   - Associate with private subnets

### 2.2 Set Up RDS Database

**Create DB Subnet Group:**
1. RDS Console → Subnet groups → Create
2. Name: `blog-db-subnet-group`
3. VPC: `blog-vpc`
4. Add both private subnets

**Create RDS Instance:**
1. RDS Console → Create database
2. Engine: MySQL
3. Template: Free tier
4. Settings:
   - DB identifier: `blog-database`
   - Master username: `admin`
   - Master password: `BlogPass123!` (use a secure password)
5. Instance: db.t3.micro
6. Storage: 20 GB
7. Network:
   - VPC: blog-vpc
   - Subnet group: blog-db-subnet-group
   - Public access: No
8. Database name: `blogapp`

### 2.3 Create S3 Buckets

```bash
# Replace 'your-unique-identifier' with something unique
aws s3 mb s3://blog-media-bucket-your-unique-identifier --region us-east-1
aws s3 mb s3://blog-website-bucket-your-unique-identifier --region us-east-1
```

**Configure Bucket Policies:**

Media Bucket Policy:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::blog-media-bucket-your-unique-identifier/*"
        }
    ]
}
```

Website Bucket Policy:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::blog-website-bucket-your-unique-identifier/*"
        }
    ]
}
```

## Phase 3: Backend Deployment

### 3.1 Create EC2 Security Group

1. EC2 Console → Security Groups → Create
2. Name: `blog-backend-sg`
3. VPC: blog-vpc
4. Inbound rules:
   - SSH (22): Your IP
   - HTTP (80): 0.0.0.0/0
   - Custom TCP (3001): 0.0.0.0/0

### 3.2 Launch EC2 Instance

1. EC2 Console → Launch Instance
2. Name: `blog-backend-server`
3. AMI: Amazon Linux 2023
4. Instance type: t2.micro
5. Key pair: Create new or select existing
6. Network:
   - VPC: blog-vpc
   - Subnet: blog-public-subnet-1
   - Auto-assign public IP: Enable
   - Security group: blog-backend-sg

### 3.3 Setup EC2 Instance

```bash
# Connect to EC2
ssh -i your-key.pem ec2-user@your-ec2-public-ip

# Update system
sudo yum update -y

# Install Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Install PM2
npm install -g pm2

# Install git
sudo yum install git -y
```

### 3.4 Deploy Backend Code

```bash
# Clone repository
git clone https://github.com/yourusername/aws-blog-site.git
cd aws-blog-site/backend

# Install dependencies
npm install

# Create .env file
nano .env
```

**.env content:**
```env
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=BlogPass123!
DB_NAME=blogapp
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
AWS_REGION=us-east-1
S3_BUCKET_NAME=blog-media-bucket-your-unique-identifier
PORT=3001
```

```bash
# Start the application
pm2 start server.js --name "blog-backend"
pm2 startup
pm2 save

# Test if running
curl http://localhost:3001/health
```

### 3.5 Create IAM Role for EC2

1. IAM Console → Roles → Create Role
2. Service: EC2
3. Policy: AmazonS3FullAccess
4. Role name: `EC2-S3-Access-Role`
5. Attach to EC2 instance: EC2 → Actions → Security → Modify IAM role

## Phase 4: Frontend Deployment

### 4.1 Build Frontend

```bash
# On your local machine
cd frontend

# Update environment variable
echo "REACT_APP_API_URL=http://your-ec2-public-ip:3001/api" > .env

# Build the application
npm run build
```

### 4.2 Deploy to S3

```bash
# Upload build files
aws s3 sync build/ s3://blog-website-bucket-your-unique-identifier --delete

# Enable static website hosting
aws s3 website s3://blog-website-bucket-your-unique-identifier \
  --index-document index.html \
  --error-document error.html
```

### 4.3 Set Up CloudFront (Optional)

1. CloudFront Console → Create Distribution
2. Origin domain: blog-website-bucket-your-unique-identifier.s3.amazonaws.com
3. Default root object: index.html
4. Custom error pages:
   - 403 → /index.html (200)
   - 404 → /index.html (200)

## Phase 5: Database Security

### 5.1 Update Database Security Group

1. Find the RDS security group
2. Edit inbound rules
3. Add rule:
   - Type: MySQL/Aurora (3306)
   - Source: EC2 Security Group or VPC CIDR (10.0.0.0/16)

## Phase 6: Testing

### 6.1 Test Backend API

```bash
# Health check
curl http://your-ec2-public-ip:3001/health

# Get posts
curl http://your-ec2-public-ip:3001/api/blog/posts
```

### 6.2 Test Frontend

1. Visit your S3 website URL or CloudFront domain
2. Try to register a new account
3. Upload a profile photo
4. Create a blog post
5. Verify it appears on homepage

## Phase 7: Domain Setup (Optional)

### 7.1 Route 53 Configuration

1. Route 53 Console → Hosted zones
2. Create hosted zone for your domain
3. Create A record pointing to CloudFront distribution

### 7.2 SSL Certificate

1. Certificate Manager → Request certificate
2. Domain: your-domain.com
3. Validation: DNS
4. Attach to CloudFront distribution

## Troubleshooting

### Common Issues

**Database Connection Failed:**
```bash
# Test connection from EC2
mysql -h your-rds-endpoint -u admin -p
```

**File Upload Issues:**
```bash
# Check IAM role
aws sts get-caller-identity

# Test S3 access
aws s3 ls s3://your-bucket-name
```

**CORS Errors:**
Update backend server.js:
```javascript
app.use(cors({
  origin: ['http://localhost:3000', 'http://your-domain.com'],
  credentials: true
}));
```

## Monitoring and Maintenance

### 7.1 Set Up CloudWatch

1. Enable detailed monitoring on EC2
2. Create alarms for:
   - CPU utilization
   - Memory usage
   - Disk space

### 7.2 Backup Strategy

1. Enable automated RDS backups
2. Set up S3 versioning
3. Create AMI snapshots

### 7.3 Security Updates

```bash
# Regular system updates
sudo yum update -y

# Update Node.js packages
npm audit fix
```

## Scaling Considerations

As your application grows, consider:

1. **Load Balancer**: Add ALB for multiple EC2 instances
2. **Auto Scaling**: Set up auto scaling groups
3. **RDS Read Replicas**: For better database performance
4. **ElastiCache**: For caching frequently accessed data
5. **Lambda Functions**: For serverless processing

## Cost Optimization

1. **Right-size instances**: Use appropriate instance types
2. **Reserved Instances**: For long-term usage
3. **S3 Lifecycle Policies**: Move old files to cheaper storage
4. **CloudWatch**: Monitor costs and set billing alerts
5. **Spot Instances**: For non-critical workloads

## Environment Variables Reference

### Backend (.env)
```env
# Database Configuration
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=your-secure-password
DB_NAME=blogapp

# Authentication
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long

# AWS Configuration
AWS_REGION=us-east-1
S3_BUCKET_NAME=blog-media-bucket-your-unique-identifier

# Server Configuration
PORT=3001
NODE_ENV=production
```

### Frontend (.env)
```env
# API Configuration
REACT_APP_API_URL=http://your-ec2-public-ip:3001/api

# Optional: Analytics
REACT_APP_GA_TRACKING_ID=your-google-analytics-id
```

## Security Checklist

- [ ] RDS is in private subnet
- [ ] Security groups follow principle of least privilege
- [ ] JWT secret is strong and unique
- [ ] S3 buckets have appropriate policies
- [ ] EC2 instance has minimal IAM permissions
- [ ] SSL/TLS enabled (if using custom domain)
- [ ] Regular security updates applied
- [ ] Database credentials rotated regularly

## Deployment Checklist

### Pre-deployment
- [ ] AWS account created and configured
- [ ] All required services enabled in your region
- [ ] Domain registered (if using custom domain)
- [ ] SSL certificate requested (if using HTTPS)

### Infrastructure
- [ ] VPC and subnets created
- [ ] Security groups configured
- [ ] RDS database created and accessible
- [ ] S3 buckets created with correct policies
- [ ] IAM roles and policies created

### Backend Deployment
- [ ] EC2 instance launched and configured
- [ ] Node.js and PM2 installed
- [ ] Application code deployed
- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] API endpoints tested

### Frontend Deployment
- [ ] React app built with correct API URL
- [ ] Files uploaded to S3
- [ ] Static website hosting enabled
- [ ] CloudFront distribution created (optional)
- [ ] Domain configured (optional)

### Testing
- [ ] User registration working
- [ ] User login working
- [ ] File uploads working
- [ ] Blog post creation working
- [ ] All posts visible on homepage
- [ ] User profile page working
- [ ] Website accessible from different devices/browsers

## Rollback Plan

If deployment fails:

1. **Database Issues**:
   ```bash
   # Restore from snapshot
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier blog-database-restored \
     --db-snapshot-identifier your-snapshot-id
   ```

2. **Backend Issues**:
   ```bash
   # Rollback to previous version
   pm2 stop blog-backend
   git checkout previous-commit
   npm install
   pm2 start server.js --name blog-backend
   ```

3. **Frontend Issues**:
   ```bash
   # Rollback frontend
   aws s3 sync previous-build/ s3://your-website-bucket --delete
   ```

## Performance Optimization

### Backend Optimizations
```javascript
// Add compression middleware
const compression = require('compression');
app.use(compression());

// Add request rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Database connection pooling (already implemented)
```

### Frontend Optimizations
```javascript
// Implement lazy loading
const CreatePost = React.lazy(() => import('./pages/CreatePost'));
const Profile = React.lazy(() => import('./pages/Profile'));

// Use React.Suspense
<Suspense fallback={<div>Loading...</div>}>
  <CreatePost />
</Suspense>
```

## Monitoring Setup

### CloudWatch Dashboards
1. Create custom dashboard
2. Add widgets for:
   - EC2 CPU utilization
   - RDS connections
   - S3 requests
   - Application errors

### Log Management
```bash
# On EC2, set up log rotation for PM2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

## Backup and Recovery

### Automated Backups
```bash
# RDS automated backups (set during creation)
# Backup retention: 7 days
# Backup window: 03:00-04:00 UTC

# S3 versioning
aws s3api put-bucket-versioning \
  --bucket your-bucket-name \
  --versioning-configuration Status=Enabled
```

### Manual Backup Script
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > backup_$DATE.sql
aws s3 cp backup_$DATE.sql s3://your-backup-bucket/

# Code backup
tar -czf code_backup_$DATE.tar.gz /home/ec2-user/aws-blog-site
aws s3 cp code_backup_$DATE.tar.gz s3://your-backup-bucket/
```

## Maintenance Schedule

### Daily
- Monitor application logs
- Check system health
- Review CloudWatch alarms

### Weekly  
- Review security groups
- Check for software updates
- Monitor costs and usage

### Monthly
- Rotate database passwords
- Review and update IAM policies
- Perform backup restore testing
- Update SSL certificates (if needed)

## Support and Resources

- **AWS Documentation**: [AWS Docs](https://docs.aws.amazon.com/)
- **AWS Free Tier**: [Free Tier Details](https://aws.amazon.com/free/)
- **Node.js Documentation**: [Node.js Docs](https://nodejs.org/docs/)
- **React Documentation**: [React Docs](https://react.dev/)
- **MySQL Documentation**: [MySQL Docs](https://dev.mysql.com/doc/)

## Next Steps

After successful deployment, consider:

1. **Implement CI/CD Pipeline**
   - AWS CodePipeline
   - GitHub Actions
   - Automated testing

2. **Add Advanced Features**
   - Real-time notifications
   - Email integration
   - Advanced search
   - Analytics dashboard

3. **Scale the Application**
   - Load balancing
   - Auto scaling
   - Microservices architecture
   - Containerization with Docker

4. **Enhance Security**
   - WAF implementation
   - VPN access
   - Multi-factor authentication
   - Regular security audits

---

**Need Help?**
If you encounter issues during deployment, check the troubleshooting section or create an issue in the GitHub repository.