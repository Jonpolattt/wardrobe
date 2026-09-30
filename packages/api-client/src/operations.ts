/** Public customer GraphQL documents; no platform code, credentials or admin mutations. */
export const PRODUCT_FIELDS = `id slug title titleRu description descriptionRu price oldPrice discountPercent
  stock sizes colors images colorImages { color images } variants { id size color stock price }
  category { id slug name nameRu image } brand { id slug name } gender { id slug name nameRu }
  rating reviewsCount isFeatured isActive createdAt`;
export const USER_FIELDS = 'id email firstName lastName avatar phone address role createdAt';
export const ORDER_FIELDS = `id orderNumber status paymentStatus paymentMethod totalAmount discountAmount promoCode
  deliveryAddress deliveryCity phone note createdAt items { id productId title price size color quantity product { ${PRODUCT_FIELDS} } }`;
export const CUSTOMER_DOCUMENTS = {
  products: `query MobileProducts($filter: ProductFilterInput!) { products(filter: $filter) { total list { ${PRODUCT_FIELDS} unitPrice } } }`,
  product: `query MobileProduct($slug: String!) { product(slug: $slug) { ${PRODUCT_FIELDS} unitPrice } }`,
  quote: `query MobileQuote($filter: ProductFilterInput!, $size: String, $color: String) { products(filter: $filter) { list { unitPrice(size: $size, color: $color) } } }`,
  categories: 'query MobileCategories { categories { id slug name nameRu image } }',
  filters: 'query MobileFilters { categories { id slug name nameRu image } brands { id slug name } genders { id slug name nameRu } productColors }',
  banners: 'query MobileBanners { banners { id image title titleRu linkType productId productSlug categoryId categorySlug products { id slug title image } } }',
  settings: `query MobileSettings { siteSettings { id heroImage contactAddress contactPhone contactTelegram contactEmail socialTelegram socialInstagram paymentCardNumber paymentCardHolder } }`,
  bestSellers: `query MobileBestSellers { bestSellers(limit: 6) { ${PRODUCT_FIELDS} unitPrice } }`,
  me: `query MobileMe { me { ${USER_FIELDS} } }`,
  login: `mutation MobileLogin($input: LoginInput!) { login(input: $input) { accessToken refreshToken user { ${USER_FIELDS} } } }`,
  register: `mutation MobileRegister($input: RegisterInput!) { register(input: $input) { accessToken refreshToken user { ${USER_FIELDS} } } }`,
  sendOtp: 'mutation MobileSendOtp($input: SendRegisterOtpInput!) { sendRegisterOtp(input: $input) }',
  verifyOtp: 'mutation MobileVerifyOtp($input: VerifyRegisterOtpInput!) { verifyRegisterOtp(input: $input) }',
  requestReset: 'mutation MobileRequestReset($input: RequestPasswordResetInput!) { requestPasswordReset(input: $input) { method } }',
  resetPassword: `mutation MobileResetPassword($input: ResetPasswordInput!) { resetPassword(input: $input) { accessToken refreshToken user { ${USER_FIELDS} } } }`,
  updateProfile: `mutation MobileUpdateProfile($input: UpdateProfileInput!) { updateProfile(input: $input) { ${USER_FIELDS} } }`,
  cart: `query MobileCart { myCart { id productId size color quantity unitPrice product { ${PRODUCT_FIELDS} } } }`,
  addCart: 'mutation MobileAddCart($input: AddToCartInput!) { addToCart(input: $input) { id productId size color quantity unitPrice } }',
  updateCart: 'mutation MobileUpdateCart($input: UpdateCartItemInput!) { updateCartItem(input: $input) { id quantity unitPrice } }',
  removeCart: 'mutation MobileRemoveCart($id: ID!) { removeCartItem(id: $id) }',
  wishlist: `query MobileWishlist { myWishlist { id productId product { ${PRODUCT_FIELDS} unitPrice } } }`,
  toggleWishlist: 'mutation MobileToggleWishlist($productId: ID!) { toggleWishlist(productId: $productId) { added } }',
  removeWishlist: 'mutation MobileRemoveWishlist($id: ID!) { removeWishlistItem(id: $id) }',
  createOrder: `mutation MobileCreateOrder($input: CreateOrderInput!) { createOrder(input: $input) { ${ORDER_FIELDS} } }`,
  orders: `query MobileOrders { myOrders { ${ORDER_FIELDS} } }`,
  order: `query MobileOrder($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`,
  promo: 'mutation MobilePromo($input: PromoCodeCheckInput!) { checkPromoCode(input: $input) { valid code message eligibleAmount discount total } }',
  reviews: 'query MobileReviews($productId: ID!) { reviews(productId: $productId) { id rating comment image createdAt user { firstName lastName } } }',
  canReview: 'query MobileCanReview($productId: ID!) { canReviewProduct(productId: $productId) }',
  createReview: 'mutation MobileReview($input: CreateReviewInput!) { createReview(input: $input) { id rating comment image createdAt user { firstName lastName } } }',
  contact: 'mutation MobileContact($input: ContactMessageInput!) { sendContactMessage(input: $input) }',
} as const;
