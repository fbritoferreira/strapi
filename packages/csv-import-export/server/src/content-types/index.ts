import schema from './job/schema';

/** The plugin's content types. */
const contentTypes: { job: { schema: typeof schema } } = {
  job: { schema },
};

export default contentTypes;
