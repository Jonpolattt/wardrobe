import { registerEnumType } from '@nestjs/graphql';
import { Role } from '@wardrobe/types';

export { Role } from '@wardrobe/types';

registerEnumType(Role, { name: 'Role' });
