import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const httpLink = new HttpLink({
  uri: '/graphql',
});

const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const wsLink = new GraphQLWsLink(
  createClient({ url: `${wsProtocol}://${window.location.host}/subscriptions` })
);

// Route subscriptions over the websocket, everything else over HTTP
const link = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === 'OperationDefinition' && def.operation === 'subscription';
  },
  wsLink,
  httpLink
);

export const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});
