# EasyShoppingMallBD API Documentation

**Base URL:** `https://api.easyshoppingmallbd.com`

> এই ফাইলে কথোপকথনে দেওয়া route/mount ও endpoint-গুলো একত্র করা হয়েছে। আগের নির্দেশনা অনুযায়ী admin/dashboard-only API বাদ রাখা হয়েছে। `:id`, `:productId`, `:userId` ইত্যাদি dynamic parameter-এর জায়গায় বাস্তব ID দিতে হবে।

## Users / Authentication

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/users/signup` | নতুন user account তৈরি |
| POST | `https://api.easyshoppingmallbd.com/api/users/signin` | User login |
| GET | `https://api.easyshoppingmallbd.com/api/users/signout` | Login session/token থেকে sign out |
| POST | `https://api.easyshoppingmallbd.com/api/users/send-otp` | OTP পাঠানো |
| POST | `https://api.easyshoppingmallbd.com/api/users/verify-otp` | OTP যাচাই |
| POST | `https://api.easyshoppingmallbd.com/api/users/reset-password` | Password reset |
| POST | `https://api.easyshoppingmallbd.com/api/users/google-auth` | Google authentication/login |
| GET | `https://api.easyshoppingmallbd.com/api/users/userprofile` | Login করা user-এর profile দেখা |
| PUT | `https://api.easyshoppingmallbd.com/api/users/userprofile` | নিজের নাম, মোবাইল, জন্মতারিখ, লিঙ্গ এবং Dropshipping shop/payment তথ্য আপডেট |
| POST | `https://api.easyshoppingmallbd.com/api/users/userprofile/email-change/request` | নতুন ইমেইলে যাচাইকরণ OTP পাঠানো |
| POST | `https://api.easyshoppingmallbd.com/api/users/userprofile/email-change/verify` | OTP যাচাই করে নিজের ইমেইল পরিবর্তন |
| PUT | `https://api.easyshoppingmallbd.com/api/users/change-password` | বর্তমান পাসওয়ার্ড যাচাই করে নিজের পাসওয়ার্ড পরিবর্তন |
| PUT | `https://api.easyshoppingmallbd.com/api/users/user-image/:id` | User profile image update; `?type=shopLogo` দিলে Dropshipping shop logo update |

উপরের profile/password endpoint-গুলোতে authenticated `Authorization: Bearer <token>` অথবা বৈধ session cookie দিতে হবে। Profile update body-তে `name`, `mobile`, `date_of_birth` (`YYYY-MM-DD` বা `null`) এবং `gender` (`Male`, `Female`, `Other` বা `null`) পাঠানো যায়। Dropshipping account হলে `shopName`, `shopAddress`, `shopWebsite`, `facebookPage`, `whatsappNumber` এবং `paymentDetails` (`bkash`, `nagad`, `rocket`, `bank`) পাঠানো যায়। `role`, account status, balance, referral statistics বা অন্যের user ID পরিবর্তনযোগ্য নয়। Email update body হলো `{ "email": "new@example.com" }`; OTP verify body হলো `{ "otp": "123456" }`. OTP ৫ মিনিট বৈধ এবং সর্বোচ্চ ৫ বার চেষ্টা করা যাবে।

Password change body হলো `{ "currentPassword": "...", "newPassword": "..." }`; নতুন পাসওয়ার্ড ৮–১২৮ অক্ষরের হতে হবে। সফল পরিবর্তনে response-এ replacement `token` ফেরত আসে; অন্য session-গুলো invalid হয়ে যায়, তাই app-কে নতুন token সংরক্ষণ করতে হবে।

Dropshipping app-এ ব্যক্তিগত Profile save এবং Shop Settings save আলাদা request হিসেবে পাঠানো হয়। Shop Settings request-এ শুধু shop/payment field পাঠানো হয়; তবে বর্তমান API contract-এ এর জন্য আলাদা URL নেই—এটি একই `PUT /api/users/userprofile` endpoint ব্যবহার করে। আলাদা backend endpoint যোগ না হওয়া পর্যন্ত অন্য route অনুমান করে ব্যবহার করা যাবে না।

Deployment verification (2026-10-21): `GET /api/users/userprofile` unauthenticated request-এ `401 Unauthorized` ফেরায় এবং `PUT /api/users/user-image/test` একইভাবে `401 Unauthorized` ফেরায়; route-গুলো registered। কিন্তু unauthenticated `PUT /api/users/userprofile` `404 Cannot PUT /api/users/userprofile` এবং `PATCH` `404 Cannot PATCH /api/users/userprofile` ফেরায়। ফলে deployed backend-এ profile/shop update route বর্তমানে অনুপস্থিত, যদিও উপরের documented contract-এ PUT উল্লেখ আছে। Backend route deploy না হওয়া পর্যন্ত app থেকে profile বা shop fields সফলভাবে update করা সম্ভব নয়।

## Products

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/products/get` | Product list পাওয়া; filter/pagination-এর তথ্য request body-তে যেতে পারে |
| POST | `https://api.easyshoppingmallbd.com/api/products/get-product-by-category` | Category অনুযায়ী product পাওয়া |
| POST | `https://api.easyshoppingmallbd.com/api/products/get-pruduct-by-category-and-subcategory` | Category ও subcategory অনুযায়ী product পাওয়া; route spelling backend-এ `pruduct` |
| GET | `https://api.easyshoppingmallbd.com/api/products/get-product-details/:productId` | নির্দিষ্ট product-এর বিস্তারিত তথ্য |
| POST | `https://api.easyshoppingmallbd.com/api/products/search-product` | Product search |
| POST | `https://api.easyshoppingmallbd.com/api/products/image-search` | Image দিয়ে product search |

### Live-verified product pagination and filters

লাইভ API-তে `POST /api/products/get` এবং `POST /api/products/search-product`-এ JSON body-র `page` ও `limit` pagination সমর্থিত। Response-এর root level-এ `data` (product array), `page`, `totalPages`, `totalCount`, `limit`, `success` থাকে। `categoryId` এবং `search` একসঙ্গে পাঠানো যায়। `sortBy` হিসেবে `discount`, `price-low`, `price-high` ও `rating` সাধারণ product-list request-এ কাজ করে।

Dropshipping Home-এর product preview-তে একই `POST /api/products/get` route ব্যবহার হয়। `sortBy: "newest"` নতুন পণ্য আগে দেখায়; `isBoost: true` চাইলে এখন published product-এর মধ্যে শুধু boosted পণ্য ফেরত আসে। `isBoost` বাদ দিলে আগের product-list আচরণ অপরিবর্তিত থাকে।

সাব-ক্যাটাগরির জন্য `POST /api/products/get-pruduct-by-category-and-subcategory`-এ `categoryId`, `subCategoryId`, `page` ও `limit` দিতে হবে। সাধারণ `/api/products/get` এবং `/api/products/search-product` request-এ `subCategoryId` লাইভ API-তে প্রয়োগ হয় না; সাব-ক্যাটাগরি endpoint-এ `search` ও `sortBy`-ও প্রয়োগ হয় না। অ্যাপ তাই সাব-ক্যাটাগরি endpoint থেকে আসা আসল product data-তেই search/sort করে; এ অবস্থায় API-র page count সাব-ক্যাটাগরির সম্পূর্ণ তালিকার, search-filtered ফলের আলাদা মোট page নয়।

`POST /api/products/get-product-by-category`-এ category id-এর body key হলো `id`; লাইভ response-এ pagination metadata পাওয়া যায়নি, তাই paginated Shop list-এ এটি ব্যবহার করা যাবে না। উপরের আচরণগুলো ১৭ অক্টোবর ২০২৬ তারিখে লাইভ API request দিয়ে যাচাই করা হয়েছে; backend পরিবর্তন হলে পুনরায় যাচাই প্রয়োজন।

Mobile Shop প্রতি request-এ ৫০টি পণ্য নেয় এবং `GET`-ধাঁচের React Query cache key-তে category, subcategory, search, server-side sort ও page রাখে; UI-তে শুধু Previous/Next চাপলেই page বদলায়। Search endpoint-এর page response-এ direct match-এর সঠিক `totalCount`/`totalPages` ফেরত আসে; fuzzy/related fallback এক পাতায় দেখানো হয়, যাতে একই fallback ফলকে ভুয়া অতিরিক্ত page হিসেবে দেখানো না হয়।

লাইভ product-list response-এ `_id`, `productName`, `images`, `price`, `dropshippingPrice`, `productRank`, `productStock`, `color` ও `sku` থাকে। Dropshipping UI-তে `dropshippingPrice`-কে ড্রপশিপারের পণ্য-খরচ এবং `productRank`-কে প্রস্তাবিত বিক্রয়মূল্য হিসেবে দেখাতে হবে; `price` হলো ecommerce মূল্য, তাই সেটি dropshipper-এর বিক্রয়মূল্য বা খরচ হিসেবে দেখানো যাবে না। দুই মূল্যের পার্থক্য শুধু আনুমানিক পণ্য-মার্জিন, সার্ভার-নিশ্চিত লাভ নয়। Subcategory product endpoint-এ `categoryId`, `subCategoryId`, `page` ও `limit` ব্যবহার হয়। Product details response-এ ঐ fields ছাড়াও optional `video` ও `video_link` থাকে; list response-এ video fields নাও থাকতে পারে, তাই catalog card কেবল দৃশ্যমান পণ্যের details fetch করে video icon দেখায়।

লাইভ category response-এ `isActive`, `name`, `image`, `icon`; subcategory response-এ `isActive`, `name`, `image`, `icon`, `category` থাকে। `category` string ID অথবা `_id` থাকা object হতে পারে। Catalog UI-তে শুধু `isActive: true` category ও subcategory দেখাতে হবে.

## Categories

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/categories/` | সব active/public category পাওয়া |
| GET | `https://api.easyshoppingmallbd.com/api/categories/get-tree` | Parent-child category tree পাওয়া |
| GET | `https://api.easyshoppingmallbd.com/api/categories/:id` | নির্দিষ্ট category-এর তথ্য পাওয়া |

## Subcategories

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/subcategories/` | Subcategory list পাওয়া |
| GET | `https://api.easyshoppingmallbd.com/api/subcategories/:id` | নির্দিষ্ট subcategory-এর তথ্য পাওয়া |

## Address

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/address/create` | User-এর delivery address যোগ করা |
| GET | `https://api.easyshoppingmallbd.com/api/address/get` | User-এর saved address দেখা |
| PUT | `https://api.easyshoppingmallbd.com/api/address/update` | Saved address update |
| DELETE | `https://api.easyshoppingmallbd.com/api/address/disable` | Address disable/remove করা |

## Home Banners

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/homeBannerRoutes/get` | Home banner list পাওয়া |
| GET | `https://api.easyshoppingmallbd.com/api/homeBannerRoutes/:id` | নির্দিষ্ট home banner দেখা |

## Center Banners

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/CenterBanner/get` | Center banner list পাওয়া |
| GET | `https://api.easyshoppingmallbd.com/api/CenterBanner/:id` | নির্দিষ্ট center banner দেখা |

## Left Banners

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/LeftBanner/get` | Left banner list পাওয়া |
| GET | `https://api.easyshoppingmallbd.com/api/LeftBanner/:id` | নির্দিষ্ট left banner দেখা |

## Right Banners

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/RightBanner/get` | Right banner list পাওয়া; route-এর সঠিকতা source route file দিয়ে নিশ্চিত করতে হবে |
| GET | `https://api.easyshoppingmallbd.com/api/RightBanner/:id` | নির্দিষ্ট right banner দেখা; route-এর সঠিকতা source route file দিয়ে নিশ্চিত করতে হবে |

## Homepage

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/homepage/` | Homepage-এর data পাওয়া |
| POST | `https://api.easyshoppingmallbd.com/api/homepage/popular-products` | Popular products data পাওয়া |

## Blog

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/blog/get` | Blog post list পাওয়া |
| GET | `https://api.easyshoppingmallbd.com/api/blog/:id` | নির্দিষ্ট blog post দেখা |

## Website Information

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/websiteinfo/get` | Website-এর public information/configuration পাওয়া |

## Referral

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/referral/get` | Referral information/settings পাওয়া |

`GET /api/websiteinfo/get` response-এর website information-এ phone (`number`/`supportContact`), `email`, `address` এবং optional `officeHours` থাকতে পারে। Office hours configure না থাকলে app কোনো সময় অনুমান করে দেখাবে না।

## Contact

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/contact/create` | Contact message/নতুন inquiry পাঠানো |

এই route-এ `{ "name": "...", "email": "...", "phone": "...", "subject": "...", "message": "..." }` JSON পাঠাতে হবে। `phone` ঐচ্ছিক; বাকি field আবশ্যক। Backend input validate করে MongoDB-তে message সংরক্ষণ করে এবং server-side configured receiver email-এ notification পাঠায়। Success response `{ "success": true, "message": "...", "emailNotificationSent": true, "data": { ... } }`; message সংরক্ষিত হলেও notification পাঠাতে ব্যর্থ হলে `emailNotificationSent` হবে `false`। Validation failure-এ `400`, এবং প্রতি IP-তে ১৫ মিনিটে ৫টির বেশি submission হলে `429` ফেরত আসে।

## Notifications

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/notification/` | Login করা user-এর notification list পাওয়া |
| PUT | `https://api.easyshoppingmallbd.com/api/notification/:id/read` | একটি notification read হিসেবে চিহ্নিত করা |
| PUT | `https://api.easyshoppingmallbd.com/api/notification/mark-all-read` | সব notification read হিসেবে চিহ্নিত করা |

## Cart

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/cart/add` | Cart-এ product যোগ করা |
| GET | `https://api.easyshoppingmallbd.com/api/cart/:userId` | নির্দিষ্ট user-এর cart পাওয়া |
| PUT | `https://api.easyshoppingmallbd.com/api/cart/update` | Cart item/quantity update |
| DELETE | `https://api.easyshoppingmallbd.com/api/cart/remove/:userId/:productId` | Cart থেকে নির্দিষ্ট product সরানো |
| DELETE | `https://api.easyshoppingmallbd.com/api/cart/clear/:userId` | User-এর cart খালি করা |

## Wishlist

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/wishlist/add` | Wishlist-এ product যোগ করা |
| GET | `https://api.easyshoppingmallbd.com/api/wishlist/` | Wishlist data পাওয়া |
| DELETE | `https://api.easyshoppingmallbd.com/api/wishlist/remove/:productId` | Wishlist থেকে product সরানো |
| DELETE | `https://api.easyshoppingmallbd.com/api/wishlist/clear` | Wishlist খালি করা |

## Orders

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/orders/create` | Cart/checkout data থেকে order তৈরি |
| POST | `https://api.easyshoppingmallbd.com/api/orders/manual` | Manual payment/order flow-তে order তৈরি |
| GET | `https://api.easyshoppingmallbd.com/api/orders/my-orders` | Login করা user-এর order history পাওয়া |
| GET | `https://api.easyshoppingmallbd.com/api/orders/:id` | নির্দিষ্ট order-এর details পাওয়া |
| POST | `https://api.easyshoppingmallbd.com/api/orders/manual-payment` | Manual payment information জমা দেওয়া |
| POST | `https://api.easyshoppingmallbd.com/api/orders/:id/pay-due` | Order-এর বকেয়া টাকা পরিশোধের request |

### Checkout payload note

Backend-এর `POST /api/orders/manual` route-এ `isAuth` ও `decryptBody` middleware চলে। Authenticated user ID `Authorization: Bearer <token>` থেকে আসে (`req.userId`); body-র `userId` পাঠালেও controller auth identity ব্যবহার করে। Request-এর field name backend-এর মতো snake_case:

```json
{
  "userId": "authenticated-user-id",
  "products": [
    { "productId": "product-id", "quantity": 2, "size": "M", "color": "Blue", "weight": "1kg" }
  ],
  "delivery_address": {
    "customer_name": "Customer name",
    "address_line": "House / road",
    "district": "ঢাকা",
    "division": "ঢাকা",
    "upazila_thana": "সাভার",
    "pincode": "1340",
    "country": "Bangladesh",
    "mobile": 1712345678
  },
  "deliveryCharge": 80,
  "subTotalAmt": 1000,
  "totalAmt": 1080,
  "payment_method": "manual",
  "payment_type": "delivery",
  "payment_details": {
    "transactionId": "TXN123456",
    "manual": {
      "provider": "bkash",
      "senderNumber": "01712345678",
      "transactionId": "TXN123456"
    }
  },
  "appliedCoupon": null,
  "couponDiscount": 0
}
```

`delivery_address` is mandatory and must contain `address_line`, `district`, `division`, `upazila_thana`, `country`, and `mobile`; `pincode` is stored but not controller-validated. `payment_method` must be `manual`. `payment_type` is `delivery` or `full`. The controller checks `payment_details.transactionId`, while the order schema persists manual-payment fields under `payment_details.manual`; send the transaction ID at both shown locations so it passes controller validation and is stored in the schema. The separate payment-submission endpoint also receives the transaction details. Product prices/names are loaded from the database. The server calculates delivery (৳80 for its Dhaka match, ৳130 otherwise), subtotal, coupon and total. Success response is `{ success, message, data: order }`, including `_id`, `orderId`, `order_status` and `payment_status`.

After creating the order, call `POST /api/orders/manual-payment` separately with `{ "orderId": "<order._id>", "provider": "bkash", "senderNumber": "...", "transactionId": "..." }`. It requires all four fields and allows `bkash`, `nagad`, `rocket`, or `upay`; success response is `{ success, message, order }`. `paidFor`/amount are not inputs to that controller; it derives paid/due amounts from the order's `payment_type`. The route is authenticated and also runs `decryptBody`. The authenticated profile supplies account name/email; the order address schema has no email field.

## Payment / SSLCommerz

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/payment/initiate` | Payment process শুরু করা |
| POST | `https://api.easyshoppingmallbd.com/api/payment/success` | Payment success callback handle করা |
| POST | `https://api.easyshoppingmallbd.com/api/payment/fail` | Payment failure callback handle করা |
| POST | `https://api.easyshoppingmallbd.com/api/payment/cancel` | Payment cancel callback handle করা |
| POST | `https://api.easyshoppingmallbd.com/api/payment/ipn` | Payment provider-এর IPN notification handle করা |

## Payment Requests

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/payment-request/create` | Payment request তৈরি/জমা দেওয়া |
| GET | `https://api.easyshoppingmallbd.com/api/payment-request/my-requests` | নিজের payment request history দেখা |

## Reviews

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/review/:productId` | Product-এর review জমা দেওয়া |
| GET | `https://api.easyshoppingmallbd.com/api/review/:productId` | Product-এর review list দেখা |
| DELETE | `https://api.easyshoppingmallbd.com/api/review/:id` | Review delete করার request |

## Coupons

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/coupon/apply` | Ecommerce order/cart-এ coupon apply করা |
| POST | `https://api.easyshoppingmallbd.com/api/coupon/apply-ds` | Dropshipping order-এ coupon apply করা |
| GET | `https://api.easyshoppingmallbd.com/api/coupon/product/:productId` | নির্দিষ্ট product-এর applicable coupon পাওয়া |

`POST /api/coupon/apply` expects `{ "code": "COUPON_CODE" }`; the backend reads the authenticated user's saved cart and validates product/category/subcategory coupon scope. Dropshipping carts use `POST /api/coupon/apply-ds` with `{ "code": "COUPON_CODE", "cartItems": [{ "productId": "...", "quantity": 1, "price": 100 }] }`; the backend reloads product prices before calculating the discount. Both return `{ success, message, discountAmount, coupon }`. The order request should include `appliedCoupon` only after a successful apply; order creation revalidates it and recalculates the discount server-side.

## Dropshipping Analytics

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/analytics/dropshipping/my-summary` | Login করা dropshipper-এর নিজের summary দেখা |

## Dropshipping Orders

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/orders/dropshipping/:id` | Dropshipping order-এর details পাওয়া; access permission প্রযোজ্য |
| PUT | `https://api.easyshoppingmallbd.com/api/orders/dropshipping/:id/status` | Dropshipping order status update; permission অনুযায়ী |
| POST | `https://api.easyshoppingmallbd.com/api/orders/dropshipping/:id/message` | Dropshipping order-এ message যোগ/পাঠানো; permission অনুযায়ী |
| PUT | `https://api.easyshoppingmallbd.com/api/orders/dropshipping/:id/keypoints` | Dropshipping order-এর key points update; permission অনুযায়ী |

## Team System / Dropshipping

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/team-system/` | Login করা user-এর team-system তথ্য পাওয়া |

## Video Courses

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/video-course/all` | Public video course list পাওয়া |

## Video Modules

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/video-module/all` | Public video module list পাওয়া |

## Video Content

| Method | Full URL | কাজ |
|---|---|---|
| GET | `https://api.easyshoppingmallbd.com/api/video-content/all` | Public video content list পাওয়া; optional authentication/cache থাকতে পারে |

## Video Access

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/video-access/create` | Video/course access request বা access record তৈরি |
| GET | `https://api.easyshoppingmallbd.com/api/video-access/my-access` | নিজের video/course access দেখা |

## Video Requests

| Method | Full URL | কাজ |
|---|---|---|
| POST | `https://api.easyshoppingmallbd.com/api/video-request/create` | Video/course সংক্রান্ত request জমা দেওয়া |
| GET | `https://api.easyshoppingmallbd.com/api/video-request/my-requests` | নিজের video request history দেখা |

## Video Request / Course Notes

এই তালিকায় কথোপকথনে দেওয়া route snippets থেকে পাওয়া endpoint-গুলো অন্তর্ভুক্ত। `RightBanner`-এর exact route এবং অন্য কোনো route file-এ থাকা কিন্তু কথোপকথনে না-দেওয়া endpoint source code ছাড়া নিশ্চিত করা যায় না। সম্পূর্ণ repository-level audit করতে প্রতিটি `routes` ফাইল এবং main app-এর `app.use(...)` mount যাচাই করতে হবে।
