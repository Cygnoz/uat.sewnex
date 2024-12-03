const request = require('supertest');
const server = require('../server'); // Import the server instance

describe('Express Server', () => {
  let app;

  beforeAll(() => {
    // Ensure the server is started before the tests
    app = server;
  });

  afterAll(() => {
    // Close the server after tests
    app.close();
  });

  it('should respond with a 200 status and welcome message at the root route', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toBe("Bill BIZZ server started - Customer");
  });
});
