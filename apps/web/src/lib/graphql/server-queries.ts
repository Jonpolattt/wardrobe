export const PRODUCT_FIELDS_STR = `
  fragment ProductFields on Product {
    id
    title
    titleRu
    slug
    description
    descriptionRu
    sku
    price
    oldPrice
    discountPercent
    stock
    sizes
    colors
    images
    colorImages { color images }
    variants { id size color stock price }
    isFeatured
    rating
    reviewsCount
    viewCount
    soldCount
    createdAt
    gender { id name nameRu slug }
    category { id name nameRu slug }
    brand { id name slug }
  }
`;

export const GET_PRODUCTS_STR = `
  ${PRODUCT_FIELDS_STR}
  query GetProducts($filter: ProductFilterInput!) {
    products(filter: $filter) {
      total
      list { ...ProductFields }
    }
  }
`;

export const GET_PRODUCT_STR = `
  ${PRODUCT_FIELDS_STR}
  query GetProduct($slug: String!) {
    product(slug: $slug) { ...ProductFields }
  }
`;

export const GET_BEST_SELLERS_STR = `
  ${PRODUCT_FIELDS_STR}
  query GetBestSellers($limit: Float) {
    bestSellers(limit: $limit) { ...ProductFields }
  }
`;

export const GET_CATEGORIES_STR = `
  query GetCategories {
    categories { id name nameRu slug description image }
  }
`;

export const GET_BRANDS_STR = `
  query GetBrands {
    brands { id name slug logo }
  }
`;

export const GET_GENDERS_STR = `
  query GetGenders {
    genders { id name nameRu slug }
  }
`;

export const GET_SITE_SETTINGS_STR = `
  query SiteSettings {
    siteSettings {
      heroImage
      contactAddress
      contactPhone
      contactTelegram
      contactEmail
      socialTelegram
      socialInstagram
      socialTiktok
      paymentCardNumber
      paymentCardHolder
    }
  }
`;

// Bosh sahifadagi reklama karuseli — faqat faol bannerlar, admin
// belgilagan tartibda (backend: modules/banner/).
export const GET_BANNERS_STR = `
  query GetBanners {
    banners {
      id
      image
      title
      titleRu
      linkType
      productSlug
      categorySlug
      products {
        id
      }
    }
  }
`;

// Do'kon filtri uchun — faqat tovarlarda haqiqatda ishlatilgan ranglar
// (backend: product.service.ts, usedColors()).
export const GET_PRODUCT_COLORS_STR = `
  query GetProductColors {
    productColors
  }
`;
