const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");

const apiId = 123456;
const apiHash = "123456abcdfg";
const stringSession = new StringSession("");

(async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: async () => await input.text("Введи номер: "),
    password: async () => await input.text("Введи пароль: "),
    phoneCode: async () => await input.text("Введи код: "),
    onError: (err) => console.log(err),
  });
  console.log("Подключено!");
  console.log(client.session.save());
  await client.sendMessage("me", { message: "Hello!" });
})();