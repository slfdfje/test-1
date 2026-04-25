import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:5002';

async function testAutomation() {
  console.log('\n🧪 Testing Blender Upload Automation\n');
  console.log('=' .repeat(60));

  // Test 1: Check server health
  console.log('\n1️⃣ Testing server health...');
  try {
    const res = await fetch(`${API_URL}/`);
    const data = await res.json();
    console.log('✅ Server is healthy:', data.status);
    console.log(`   Total models: ${data.totalModels}`);
  } catch (error) {
    console.error('❌ Server health check failed:', error.message);
    return;
  }

  // Test 2: Check stats endpoint
  console.log('\n2️⃣ Testing stats endpoint...');
  try {
    const res = await fetch(`${API_URL}/admin/stats`);
    const stats = await res.json();
    console.log('✅ Stats retrieved successfully');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Processing: ${stats.processing}`);
    console.log(`   Generated: ${stats.generated}`);
    console.log(`   Approved: ${stats.approved}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Queue: ${stats.queue.active}/${stats.queue.maxConcurrent} active, ${stats.queue.queued} queued`);
  } catch (error) {
    console.error('❌ Stats check failed:', error.message);
    return;
  }

  // Test 3: Test dimension validation (should fail)
  console.log('\n3️⃣ Testing dimension validation (invalid dimensions)...');
  try {
    const formData = new FormData();
    formData.append('image', fs.createReadStream('thumbnails/4e8abb9b-0b56-4ccd-a8da-a5ff72fe3d9f.jpg'));
    formData.append('brand', 'Test Brand');
    formData.append('model', 'Test Model');
    formData.append('price', '99.99');
    formData.append('category', 'sunglasses');
    formData.append('frameWidth', '50'); // Invalid: too small
    formData.append('bridgeWidth', '5'); // Invalid: too small
    formData.append('templeLength', '200'); // Invalid: too large

    const res = await fetch(`${API_URL}/admin/upload-glasses`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    
    if (res.status === 400 && data.validationErrors) {
      console.log('✅ Validation working correctly');
      console.log('   Errors:', data.validationErrors.join(', '));
    } else {
      console.log('❌ Validation should have failed but didn\'t');
    }
  } catch (error) {
    console.error('❌ Validation test failed:', error.message);
  }

  // Test 4: Upload with valid dimensions (should succeed and trigger generation)
  console.log('\n4️⃣ Testing upload with valid dimensions...');
  let uploadedId = null;
  try {
    const formData = new FormData();
    formData.append('image', fs.createReadStream('thumbnails/4e8abb9b-0b56-4ccd-a8da-a5ff72fe3d9f.jpg'));
    formData.append('brand', 'Test Automation');
    formData.append('model', 'Auto-Gen Test');
    formData.append('price', '149.99');
    formData.append('category', 'sunglasses');
    formData.append('frameWidth', '140');
    formData.append('bridgeWidth', '20');
    formData.append('templeLength', '145');

    const res = await fetch(`${API_URL}/admin/upload-glasses`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    
    if (data.success) {
      uploadedId = data.id;
      console.log('✅ Upload successful');
      console.log(`   ID: ${data.id}`);
      console.log(`   Status: ${data.item.status}`);
      console.log(`   Generation Status: ${data.item.generationStatus}`);
      console.log('   ⏳ Generation started automatically...');
    } else {
      console.log('❌ Upload failed:', data.error);
      return;
    }
  } catch (error) {
    console.error('❌ Upload test failed:', error.message);
    return;
  }

  // Test 5: Monitor generation progress
  console.log('\n5️⃣ Monitoring generation progress...');
  let attempts = 0;
  const maxAttempts = 40; // 40 attempts * 3 seconds = 2 minutes max
  
  while (attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

    try {
      const res = await fetch(`${API_URL}/admin/glasses/${uploadedId}`);
      const item = await res.json();

      console.log(`   [${attempts}] Status: ${item.generationStatus}`);

      if (item.generationStatus === 'generated') {
        console.log('✅ Generation completed successfully!');
        console.log(`   Model URL: ${item.modelUrl}`);
        console.log(`   Duration: ${new Date(item.generationCompletedAt) - new Date(item.generationStartedAt)}ms`);
        
        // Verify file exists
        const modelPath = `.${item.modelUrl}`;
        if (fs.existsSync(modelPath)) {
          const stats = fs.statSync(modelPath);
          console.log(`   File size: ${stats.size} bytes`);
          console.log('✅ GLB file verified');
        } else {
          console.log('❌ GLB file not found');
        }
        break;
      } else if (item.generationStatus === 'failed') {
        console.log('❌ Generation failed');
        console.log(`   Error: ${item.generationError}`);
        break;
      }
    } catch (error) {
      console.error('❌ Status check failed:', error.message);
      break;
    }
  }

  if (attempts >= maxAttempts) {
    console.log('⚠️ Generation timeout - took longer than expected');
  }

  // Test 6: Test retry functionality (if failed)
  console.log('\n6️⃣ Testing retry functionality...');
  try {
    const res = await fetch(`${API_URL}/admin/glasses/${uploadedId}`);
    const item = await res.json();

    if (item.generationStatus === 'failed') {
      console.log('   Attempting retry...');
      const retryRes = await fetch(`${API_URL}/admin/retry-model/${uploadedId}`, {
        method: 'POST'
      });
      const retryData = await retryRes.json();

      if (retryData.success) {
        console.log('✅ Retry initiated successfully');
        console.log(`   Status: ${retryData.item.generationStatus}`);
      } else {
        console.log('❌ Retry failed:', retryData.error);
      }
    } else {
      console.log('⏭️ Skipping retry test (generation succeeded)');
    }
  } catch (error) {
    console.error('❌ Retry test failed:', error.message);
  }

  // Test 7: Check final stats
  console.log('\n7️⃣ Checking final stats...');
  try {
    const res = await fetch(`${API_URL}/admin/stats`);
    const stats = await res.json();
    console.log('✅ Final stats:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Processing: ${stats.processing}`);
    console.log(`   Generated: ${stats.generated}`);
    console.log(`   Approved: ${stats.approved}`);
    console.log(`   Failed: ${stats.failed}`);
  } catch (error) {
    console.error('❌ Final stats check failed:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Automation test completed!\n');
}

testAutomation().catch(console.error);
