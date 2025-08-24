const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

const uploadToS3 = (buffer, fileName, contentType) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read'
  };

  return s3.upload(params).promise();
};

module.exports = { uploadToS3 };