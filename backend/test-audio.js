import fs from 'fs';
import path from 'path';

const logFile = '/home/iamwaheed/.npm/_logs/2024-test.log'; // Usually npm logs are stored, but not standard out.
// Wait, I can just make a direct request to the backend.

import axios from 'axios';
import FormData from 'form-data';

async function test() {
  try {
    const formData = new FormData();
    formData.append('authorId', '64b1f...fake');
    formData.append('content', 'Test');
    formData.append('token', 'fake-token');
    
    // Create a dummy audio file
    fs.writeFileSync('dummy.mp3', 'dummy content');
    formData.append('audio', fs.createReadStream('dummy.mp3'));

    const res = await axios.post('http://localhost:5005/audio-tweet', formData, {
      headers: formData.getHeaders()
    });
    console.log(res.data);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}

test();
