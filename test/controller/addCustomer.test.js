const request = require('supertest');
const app = require('../../server'); 
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Customer = require('../../database/model/customer'); 

describe('POST /customers', () => {

    const token = jwt.sign(
        {
            id: '6732f82b9a861741889a538c',
            organizationId: 'INDORG0001',
            userName: 'Thaha',
            ip: '192.168.0.1',  
            userAgent: 'Mozilla/5.0',  
            iat: Math.floor(Date.now() / 1000), 
            nbf: Math.floor(Date.now() / 1000),

        },
        process.env.JWT_SECRET, 
        { expiresIn: '12h' }
   );
  

  it('should add a new customer successfully', async () => {
    const newCustomer = {
      firstName: 'John',
      lastName: 'Doe',
      customerEmail: 'john.doe@example.com',
      // Include other necessary customer data here
    };

    const response = await request(app)
      .post('/add-customer')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'TestAgent/1.0')
      .send(newCustomer)
      .expect(201);

    expect(response.body).toHaveProperty('_id');
    expect(response.body.firstName).toBe('John');
    expect(response.body.lastName).toBe('Doe');
  });

  it('should return an error if required fields are missing', async () => {
    const newCustomer = {
      firstName: 'John',
      // lastName is missing, which should trigger an error
    };

    const response = await request(app)
      .post('/add-customer')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'TestAgent/1.0')
      .send(newCustomer)
      .expect(400); // Expecting Bad Request due to missing data

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Last name is required');
  });
});
