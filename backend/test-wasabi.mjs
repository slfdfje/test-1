import AWS from "aws-sdk";
import dotenv from "dotenv";

dotenv.config();

console.log("Testing Wasabi Connection...\n");
console.log("Configuration:");
console.log("- Access Key:", process.env.AWS_ACCESS_KEY_ID?.substring(0, 10) + "...");
console.log("- Endpoint:", process.env.AWS_ENDPOINT);
console.log("- Region:", process.env.AWS_REGION);
console.log("- Bucket:", process.env.S3_BUCKET);
console.log("");

const s3 = new AWS.S3({
  endpoint: process.env.AWS_ENDPOINT,
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  signatureVersion: "v4",
  s3ForcePathStyle: true
});

console.log("Testing bucket access...\n");

// Test 1: List buckets
s3.listBuckets((err, data) => {
  if (err) {
    console.error("❌ Failed to list buckets:");
    console.error(err.message);
  } else {
    console.log("✅ Successfully connected to Wasabi!");
    console.log("Available buckets:", data.Buckets.map(b => b.Name).join(", "));
  }
  
  // Test 2: List objects in jigu bucket
  console.log("\nTesting 'jigu' bucket...\n");
  s3.listObjectsV2({ Bucket: process.env.S3_BUCKET }, (err, data) => {
    if (err) {
      console.error("❌ Failed to access jigu bucket:");
      console.error(err.message);
    } else {
      console.log("✅ Successfully accessed jigu bucket!");
      console.log(`Found ${data.Contents?.length || 0} objects`);
      
      if (data.Contents && data.Contents.length > 0) {
        console.log("\nFirst 10 objects:");
        data.Contents.slice(0, 10).forEach(obj => {
          console.log(`  - ${obj.Key} (${(obj.Size / 1024).toFixed(2)} KB)`);
        });
      }
    }
  });
});
