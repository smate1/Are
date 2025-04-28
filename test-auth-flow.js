const axios = require('axios');
const fs = require('fs');

// Base URL for the API
const API_URL = 'http://localhost:5002';

// Log output to file and console
function log(message) {
  console.log(message);
  fs.appendFileSync('auth-test-results.log', message + '\n');
}

// Clear previous log
if (fs.existsSync('auth-test-results.log')) {
  fs.unlinkSync('auth-test-results.log');
}

// Test the API status endpoint
async function testApiStatus() {
  log('\n=== Testing API Status ===');
  try {
    const response = await axios.get(`${API_URL}/api/status`);
    log(`Status: ${response.status}`);
    log(`Data: ${JSON.stringify(response.data, null, 2)}`);
    return true;
  } catch (error) {
    log(`Error testing API status: ${error.message}`);
    if (error.response) {
      log(`Response status: ${error.response.status}`);
      log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

// Test login functionality
async function testLogin(username, password) {
  log('\n=== Testing Login ===');
  log(`Attempting login with username: ${username}, password: ${'*'.repeat(password.length)}`);

  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      username,
      password
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    log(`Login status: ${response.status}`);
    log(`Login response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.data.token) {
      log('✅ Login successful! Token received.');
      return response.data.token;
    } else {
      log('❌ Login failed - no token received');
      return null;
    }
  } catch (error) {
    log(`❌ Error during login: ${error.message}`);
    if (error.response) {
      log(`Response status: ${error.response.status}`);
      log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

// Test token validation
async function testTokenValidation(token) {
  log('\n=== Testing Token Validation ===');

  if (!token) {
    log('No token provided, skipping validation test');
    return false;
  }

  try {
    const response = await axios.get(`${API_URL}/auth/validate-token`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    log(`Validation status: ${response.status}`);
    log(`Validation response: ${JSON.stringify(response.data, null, 2)}`);
    log('✅ Token validation successful!');
    return true;
  } catch (error) {
    log(`❌ Error validating token: ${error.message}`);
    if (error.response) {
      log(`Response status: ${error.response.status}`);
      log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

// Test profile access
async function testProfileAccess(token) {
  log('\n=== Testing Profile Access ===');

  if (!token) {
    log('No token provided, skipping profile access test');
    return false;
  }

  try {
    const response = await axios.get(`${API_URL}/profile/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    log(`Profile access status: ${response.status}`);
    log(`Profile data: ${JSON.stringify(response.data, null, 2)}`);
    log('✅ Profile access successful!');
    return true;
  } catch (error) {
    log(`❌ Error accessing profile: ${error.message}`);
    if (error.response) {
      log(`Response status: ${error.response.status}`);
      log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

// Test auth flow
async function testAuthFlow() {
  log('Starting authentication flow tests...');
  log(`Time: ${new Date().toISOString()}`);

  // Step 1: Test API Status
  const apiStatus = await testApiStatus();
  if (!apiStatus) {
    log('❌ API Status check failed, aborting remaining tests');
    return;
  }

  // Step 2: Test login with valid credentials
  const token = await testLogin('testuser', 'password123');
  if (!token) {
    log('❌ Login failed, aborting remaining tests');
    return;
  }

  // Step 3: Test token validation
  const tokenValid = await testTokenValidation(token);
  if (!tokenValid) {
    log('❌ Token validation failed, aborting remaining tests');
    return;
  }

  // Step 4: Test profile access
  const profileAccess = await testProfileAccess(token);
  if (!profileAccess) {
    log('❌ Profile access failed');
  }

  log('\n=== Auth Flow Test Summary ===');
  log(`API Status Check: ${apiStatus ? '✅ Passed' : '❌ Failed'}`);
  log(`Login: ${token ? '✅ Passed' : '❌ Failed'}`);
  log(`Token Validation: ${tokenValid ? '✅ Passed' : '❌ Failed'}`);
  log(`Profile Access: ${profileAccess ? '✅ Passed' : '❌ Failed'}`);

  if (apiStatus && token && tokenValid && profileAccess) {
    log('\n🎉 SUCCESS: All authentication tests passed!');
  } else {
    log('\n❌ FAILURE: One or more authentication tests failed');
  }
}

// Run all tests
testAuthFlow().catch(error => {
  log(`Unhandled error during tests: ${error.message}`);
  log(error.stack);
});
