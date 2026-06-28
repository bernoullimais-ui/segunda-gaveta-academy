const body = {
  "Type": "Message",
  "EventDate": "2026-06-27T21:25:24.093716Z",
  "Payload": {
    "Type": "Chat",
    "Content": {
      "Contact": {
        "PhoneNumber": "+5511987654321"
      },
      "Text": "Mensagem de teste"
    }
  }
};

const c = body.Payload?.Content || {};
const fromPhone = c.Contact?.PhoneNumber || '';
const text = c.Text || c.Message || c.Body || '';

console.log('Phone:', fromPhone);
console.log('Text:', text);
