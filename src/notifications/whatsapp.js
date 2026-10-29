const { USE_MOCKS } = require('../mocks');
const { sendWhatsApp: sendWhatsAppMock } = require('../mocks/twilio.mock');

async function sendWhatsApp(clientId, pdfPath, score) {
  if (USE_MOCKS) return sendWhatsAppMock(clientId, pdfPath, score);
  // A real send needs Twilio credentials and an approved WhatsApp template.
  throw new Error('Twilio WhatsApp is not configured; set USE_MOCKS=true');
}

// Email follows the same pattern: console.log mock, real provider not wired up.
async function sendEmail(clientId, pdfPath, score) {
  if (USE_MOCKS) {
    console.log('[MOCK EMAIL] → Client:', clientId);
    console.log('[MOCK EMAIL] → Score: ', score + '/100');
    console.log('[MOCK EMAIL] → Attachment:', pdfPath);
    return { status: 'mock_sent', id: 'MOCK_EMAIL_' + Date.now() };
  }
  throw new Error('Email provider is not configured; set USE_MOCKS=true');
}

module.exports = { sendWhatsApp, sendEmail };
