import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { Product } from '../../product/models/product.model';

@ObjectType()
export class CartItem {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  productId: string;

  @Field(() => Product, { nullable: true })
  product?: Product;

  @Field({ nullable: true })
  size?: string;

  @Field({ nullable: true })
  color?: string;

  // Server-computed display price; checkout still recomputes the final total.
  @Field(() => Float)
  unitPrice: number;

  @Field(() => Int)
  quantity: number;

  @Field()
  createdAt: Date;
}
