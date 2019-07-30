import axios from 'axios';

function createInstance() {
	return axios.create({
		baseURL: 'http://127.0.0.1:3000',
	});
}

const instance = createInstance();

function generateProof(params) {
	return instance.post('/circuit', params);
}

export {
	generateProof
};