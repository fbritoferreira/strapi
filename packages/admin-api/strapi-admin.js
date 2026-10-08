export default {
  register(_app) {},
  bootstrap() {
    console.log('🚀 Admin API Plugin initialized');
  },
  registerTrads(_locales) {
    return {
      messages: {},
    };
  },
};