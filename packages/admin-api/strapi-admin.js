export default {
  register(app) {},
  bootstrap() {
    console.log('🚀 Admin API Plugin initialized');
  },
  registerTrads({ locales }) {
    return {
      messages: {},
    };
  },
};
