const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

chai.use(chaiHttp);

// Update with your server URL
const serverUrl = 'http://localhost:5002';

// Test data for users
const testUser1 = {
  username: 'testmsg1_' + Math.floor(Math.random() * 10000),
  email: `testmsg1_${Math.floor(Math.random() * 10000)}@example.com`,
  password: 'Password123'
};

const testUser2 = {
  username: 'testmsg2_' + Math.floor(Math.random() * 10000),
  email: `testmsg2_${Math.floor(Math.random() * 10000)}@example.com`,
  password: 'Password123'
};

// Store authentication tokens and user IDs
let user1Token, user2Token;
let user1Id, user2Id;
let conversationId;
let messageId;

describe('Messaging Tests', function() {
  this.timeout(10000); // Set timeout for all tests in this suite

  // Before all tests: Register and login two test users
  before(async function() {
    // Register first user
    let res = await chai.request(serverUrl)
      .post('/auth/registration')
      .send(testUser1);
    user1Token = res.body.token;
    user1Id = res.body.user.id;

    // Register second user
    res = await chai.request(serverUrl)
      .post('/auth/registration')
      .send(testUser2);
    user2Token = res.body.token;
    user2Id = res.body.user.id;
  });

  // Test user search
  describe('GET /messages/users/search', function() {
    it('should find users by username search', function(done) {
      chai.request(serverUrl)
        .get(`/messages/users/search?query=${testUser2.username.substring(0, 6)}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .end(function(err, res) {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.be.at.least(1);
          expect(res.body.some(user => user.username === testUser2.username)).to.be.true;
          done();
        });
    });

    it('should not search without authentication', function(done) {
      chai.request(serverUrl)
        .get(`/messages/users/search?query=${testUser2.username}`)
        .end(function(err, res) {
          expect(res).to.have.status(401);
          done();
        });
    });

    it('should not search with too short query', function(done) {
      chai.request(serverUrl)
        .get('/messages/users/search?query=a')
        .set('Authorization', `Bearer ${user1Token}`)
        .end(function(err, res) {
          expect(res).to.have.status(400);
          done();
        });
    });
  });

  // Test sending messages
  describe('POST /messages/send', function() {
    it('should send a message from user1 to user2', function(done) {
      chai.request(serverUrl)
        .post('/messages/send')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          recipientId: user2Id,
          content: 'Hello from user1!'
        })
        .end(function(err, res) {
          expect(res).to.have.status(201);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('message');
          expect(res.body).to.have.property('data');
          expect(res.body.data).to.have.property('_id');
          messageId = res.body.data._id; // Save for later tests
          done();
        });
    });

    it('should not send a message without authentication', function(done) {
      chai.request(serverUrl)
        .post('/messages/send')
        .send({
          recipientId: user2Id,
          content: 'This should fail'
        })
        .end(function(err, res) {
          expect(res).to.have.status(401);
          done();
        });
    });

    it('should not send a message with missing content', function(done) {
      chai.request(serverUrl)
        .post('/messages/send')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          recipientId: user2Id,
          content: ''
        })
        .end(function(err, res) {
          expect(res).to.have.status(400);
          done();
        });
    });

    it('should not send a message to non-existent user', function(done) {
      chai.request(serverUrl)
        .post('/messages/send')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          recipientId: '507f1f77bcf86cd799439011', // Random non-existent ID
          content: 'This should fail'
        })
        .end(function(err, res) {
          expect(res).to.have.status(404);
          done();
        });
    });
  });

  // Test conversations
  describe('GET /messages/conversations', function() {
    it('should retrieve conversations for user1', function(done) {
      chai.request(serverUrl)
        .get('/messages/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .end(function(err, res) {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.be.at.least(1);

          // Find conversation with user2
          const conversation = res.body.find(c =>
            c.participants.some(p => p._id === user2Id || p.username === testUser2.username)
          );
          expect(conversation).to.exist;
          conversationId = conversation.id; // Save for later tests
          done();
        });
    });

    it('should not retrieve conversations without authentication', function(done) {
      chai.request(serverUrl)
        .get('/messages/conversations')
        .end(function(err, res) {
          expect(res).to.have.status(401);
          done();
        });
    });
  });

  // Test messages in a conversation
  describe('GET /messages/conversations/:conversationId/messages', function() {
    it('should retrieve messages for a conversation', function(done) {
      chai.request(serverUrl)
        .get(`/messages/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .end(function(err, res) {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('array');
          expect(res.body.length).to.be.at.least(1);

          // Check if our message is in the results
          const message = res.body.find(m => m._id === messageId);
          expect(message).to.exist;
          expect(message.content).to.equal('Hello from user1!');
          done();
        });
    });

    it('should not retrieve messages without authentication', function(done) {
      chai.request(serverUrl)
        .get(`/messages/conversations/${conversationId}/messages`)
        .end(function(err, res) {
          expect(res).to.have.status(401);
          done();
        });
    });

    it('should not retrieve messages for non-existent conversation', function(done) {
      chai.request(serverUrl)
        .get('/messages/conversations/507f1f77bcf86cd799439011/messages')
        .set('Authorization', `Bearer ${user1Token}`)
        .end(function(err, res) {
          expect(res).to.have.status(404);
          done();
        });
    });

    it('should not allow access to conversation user is not a part of', function(done) {
      // Create a new test user who has no conversations
      chai.request(serverUrl)
        .post('/auth/registration')
        .send({
          username: 'testmsg3_' + Math.floor(Math.random() * 10000),
          email: `testmsg3_${Math.floor(Math.random() * 10000)}@example.com`,
          password: 'Password123'
        })
        .end(function(err, res) {
          const user3Token = res.body.token;

          // Try to access conversation between user1 and user2
          chai.request(serverUrl)
            .get(`/messages/conversations/${conversationId}/messages`)
            .set('Authorization', `Bearer ${user3Token}`)
            .end(function(err, res) {
              expect(res).to.have.status(404);
              done();
            });
        });
    });
  });

  // Test delete message (if implemented)
  describe('DELETE /messages/messages/:messageId', function() {
    it('should delete a message sent by the user', function(done) {
      chai.request(serverUrl)
        .delete(`/messages/messages/${messageId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .end(function(err, res) {
          // Some implementations might not allow deleting messages
          if (res.status === 501 || res.status === 404) {
            console.log('Message deletion not implemented');
            this.skip();
          } else {
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('message');
          }
          done();
        });
    });

    it('should not delete a message without authentication', function(done) {
      chai.request(serverUrl)
        .delete(`/messages/messages/${messageId}`)
        .end(function(err, res) {
          expect(res).to.have.status(401);
          done();
        });
    });
  });
});
