const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

chai.use(chaiHttp);

// Update with your server URL
const serverUrl = 'http://localhost:5002';

// Test data
const testUser = {
  username: 'testuser_' + Math.floor(Math.random() * 10000),
  email: `test_${Math.floor(Math.random() * 10000)}@example.com`,
  password: 'Password123'
};

let authToken;

describe('Authentication Tests', function() {
  this.timeout(10000); // Set timeout for all tests in this suite

  // Test registration
  describe('POST /auth/registration', function() {
    it('should register a new user', function(done) {
      chai.request(serverUrl)
        .post('/auth/registration')
        .send(testUser)
        .end(function(err, res) {
          expect(res).to.have.status(201);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('status').equal('success');
          expect(res.body).to.have.property('message');
          expect(res.body).to.have.property('token');
          expect(res.body).to.have.property('user');
          done();
        });
    });

    it('should not register with existing username', function(done) {
      chai.request(serverUrl)
        .post('/auth/registration')
        .send(testUser)
        .end(function(err, res) {
          expect(res).to.have.status(400);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('status').equal('error');
          done();
        });
    });

    it('should not register with invalid data', function(done) {
      chai.request(serverUrl)
        .post('/auth/registration')
        .send({
          username: 'a', // Too short
          email: 'not-an-email',
          password: '123' // Too short
        })
        .end(function(err, res) {
          expect(res).to.have.status(400);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('status').equal('error');
          expect(res.body).to.have.property('errors').to.be.an('array');
          done();
        });
    });
  });

  // Test login
  describe('POST /auth/login', function() {
    it('should login successfully with correct credentials', function(done) {
      chai.request(serverUrl)
        .post('/auth/login')
        .send({
          identifier: testUser.username,
          password: testUser.password
        })
        .end(function(err, res) {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('status').equal('success');
          expect(res.body).to.have.property('token');
          authToken = res.body.token; // Save token for later tests
          done();
        });
    });

    it('should login with email instead of username', function(done) {
      chai.request(serverUrl)
        .post('/auth/login')
        .send({
          identifier: testUser.email,
          password: testUser.password
        })
        .end(function(err, res) {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('status').equal('success');
          done();
        });
    });

    it('should not login with incorrect password', function(done) {
      chai.request(serverUrl)
        .post('/auth/login')
        .send({
          identifier: testUser.username,
          password: 'wrong_password'
        })
        .end(function(err, res) {
          expect(res).to.have.status(400);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('status').equal('error');
          done();
        });
    });

    it('should not login with non-existent user', function(done) {
      chai.request(serverUrl)
        .post('/auth/login')
        .send({
          identifier: 'nonexistent_user',
          password: 'any_password'
        })
        .end(function(err, res) {
          expect(res).to.have.status(400);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('status').equal('error');
          done();
        });
    });
  });

  // Test profile access
  describe('GET /profile/profile', function() {
    it('should access profile with valid token', function(done) {
      chai.request(serverUrl)
        .get('/profile/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .end(function(err, res) {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('username').equal(testUser.username);
          expect(res.body).to.have.property('email').equal(testUser.email);
          done();
        });
    });

    it('should not access profile without token', function(done) {
      chai.request(serverUrl)
        .get('/profile/profile')
        .end(function(err, res) {
          expect(res).to.have.status(401);
          done();
        });
    });

    it('should not access profile with invalid token', function(done) {
      chai.request(serverUrl)
        .get('/profile/profile')
        .set('Authorization', 'Bearer invalid_token')
        .end(function(err, res) {
          expect(res).to.have.status(401);
          done();
        });
    });
  });

  // Test logout
  describe('POST /auth/logout', function() {
    it('should logout successfully', function(done) {
      chai.request(serverUrl)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .end(function(err, res) {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('status').equal('success');
          done();
        });
    });
  });
});
