import { registerEnumType } from '@nestjs/graphql';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@wardrobe/types';

export { OrderStatus } from '@wardrobe/types';
registerEnumType(OrderStatus, { name: 'OrderStatus' });

export { PaymentMethod } from '@wardrobe/types';
registerEnumType(PaymentMethod, { name: 'PaymentMethod' });

export { PaymentStatus } from '@wardrobe/types';
registerEnumType(PaymentStatus, { name: 'PaymentStatus' });
