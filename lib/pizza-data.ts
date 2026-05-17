export interface Pizza {
  id: string
  name: string
  description: string
  price: number
  noSizeToggle?: boolean
}

export const pizzas: Pizza[] = [
  {
    id: "pepperoni",
    name: "Pepperoni",
    description: "Classic pepperoni with mozzarella and tomato sauce",
    price: 14.99,
  },
  {
    id: "bbq",
    name: "BBQ",
    description: "BBQ sauce base with your favorite toppings",
    price: 15.99,
  },
  {
    id: "pizza-lab",
    name: "Pizza Lab",
    description: "Our signature experimental creation",
    price: 16.99,
  },
  {
    id: "sunshine",
    name: "Sunshine",
    description: "A bright and flavorful combination",
    price: 15.99,
  },
  {
    id: "rise-and-shine",
    name: "Rise and Shine",
    description: "Perfect morning-inspired flavors",
    price: 15.99,
  },
  {
    id: "ocd",
    name: "OCD",
    description: "Perfectly balanced, as all things should be",
    price: 16.99,
  },
  {
    id: "vego",
    name: "Vego",
    description: "Delicious vegetarian pizza",
    price: 14.99,
  },
  {
    id: "cheezy",
    name: "Cheezy",
    description: "Extra cheese goodness",
    price: 14.99,
  },
  {
    id: "vego-and-cheezy",
    name: "Vego & Cheezy",
    description: "Vegetarian with extra cheese combo",
    price: 14.99,
    noSizeToggle: true,
  },
]

export interface Side {
  id: string
  name: string
  description: string
  price: number
}

export const sides: Side[] = [
  {
    id: "kransky-dog",
    name: "Kransky Dog",
    description: "Grilled kransky sausage in a fresh bun",
    price: 8.99,
  },
  {
    id: "garlic-bread",
    name: "Garlic Bread",
    description: "Crispy garlic bread with herb butter",
    price: 5.99,
  },
  {
    id: "wedges",
    name: "Wedges",
    description: "Seasoned potato wedges with sour cream",
    price: 6.99,
  },
]

export interface OrderItem {
  pizza?: Pizza
  side?: Side
  isFullPizza: boolean
  quantity: number
}

export interface Order {
  id: string
  items: OrderItem[]
  status: "pending" | "preparing" | "ready" | "completed"
  createdAt: Date
  tableNumber?: number
  orderType: "front" | "takeaway"
  orderNumber?: string
}
