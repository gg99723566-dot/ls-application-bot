# LS Mongolia Application Bot

Website-ээс ирсэн ажлын анкетыr Discord channel-д Accept/Deny товчтой embed болгон илгээдэг bot.

## Асаах

```bash
cd ls-application-bot
npm install
copy .env.example .env
npm start
```

`.env` дотор Discord bot token болон channel ID-уудаа бөглөнө.

## Website холбох

Bot-оо Render/Railway/VPS дээр deploy хийгээд public URL гаргана.
Дараа нь `Ажил.html` доторх `APPLICATION_BOT_API_URL`-ийг:

```js
const APPLICATION_BOT_API_URL = "https://your-bot-host.com/applications";
```

болгож солино.

`role-access.js` доторх `API_URL`-ийг bot host root URL болгоно:

```js
const API_URL = "https://your-bot-host.com";
```

Ингэснээр website Discord login token-оо bot руу явуулж, bot Discord server дээрээс тухайн user-ийн roles-ийг шалгаад menu/dashboard permission буцаана.

## Role access

`.env` дээр role ID-уудаа comma-аар бичнэ.

- `ADMIN_ROLE_IDS`: бүх dropdown/module, staff, police, medic, roster, applications бүгдийг харна.
- `ADMIN_USER_IDS`: role өгөөгүй байсан ч тухайн Discord user ID-г шууд admin гэж танина.
- `STAFF_ROLE_IDS`: application queue зэрэг staff хэсгүүдийг харна.
- `POLICE_CHIEF_ROLE_IDS`: зөвхөн цагдаагийн анкет, police roster хэсгийг удирдана.
- `MEDIC_CHIEF_ROLE_IDS`: зөвхөн эмнэлгийн анкет, medic roster хэсгийг удирдана.
- `POLICE_ROLE_IDS`: police roster/public police хэсэг харна.
- `MEDIC_ROLE_IDS`: medic roster/public medic хэсэг харна.
- Role байхгүй энгийн user: үндсэн website, машин авах public хэсгээс өөр dashboard/dropdown харахгүй.

## Discord Developer Portal

Bot дээр дараах intent-үүдийг асаана:

- Server Members Intent
- Message Content Intent шаардлагагүй

Bot-д channel дээр message send/edit хийх эрх хэрэгтэй.

## Data хадгалалт

Анкетууд `DATA_DIR/applications.json` файлд хадгалагдана. Bot restart хийсэн ч queue болон status үлдэнэ.

```env
DATA_DIR=./data
```

Render/Railway зэрэг ephemeral disk-тэй host дээр database эсвэл persistent volume ашиглавал илүү найдвартай.
