import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent, Float } from '@nestjs/graphql';
import { UseGuards, NotFoundException } from '@nestjs/common';
import { CartItem } from './models/cart-item.model';
import { CartService } from './cart.service';
import { AddToCartInput, UpdateCartItemInput } from './dto/cart.input';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { User } from '../user/models/user.model';
import { resolveUnitPrice } from '../../common/utils/variant-price.util';

@Resolver(() => CartItem)
@UseGuards(GqlAuthGuard)
export class CartResolver {
  constructor(private readonly cartService: CartService) {}

  @ResolveField(() => Float)
  unitPrice(@Parent() item: CartItem): number {
    if (!item.product) throw new NotFoundException('Cart product not found');
    return resolveUnitPrice(item.product, item.size, item.color);
  }

  @Query(() => [CartItem])
  myCart(@CurrentUser() user: User) {
    return this.cartService.myCart(user.id);
  }

  @Mutation(() => CartItem)
  addToCart(@CurrentUser() user: User, @Args('input') input: AddToCartInput) {
    return this.cartService.add(user.id, input);
  }

  @Mutation(() => CartItem)
  updateCartItem(@CurrentUser() user: User, @Args('input') input: UpdateCartItemInput) {
    return this.cartService.updateQuantity(user.id, input);
  }

  @Mutation(() => Boolean)
  removeCartItem(@CurrentUser() user: User, @Args('id', { type: () => ID }) id: string) {
    return this.cartService.remove(user.id, id);
  }

  @Mutation(() => Boolean)
  clearCart(@CurrentUser() user: User) {
    return this.cartService.clear(user.id);
  }
}
