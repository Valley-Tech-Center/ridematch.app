/**
 * Represents an airport.
 */
export interface Airport {
  /**
   * The airport code (e.g., SFO, LAX).
   */
  code: string;
  /**
   * The name of the airport.
   */
  name: string;
  /**
   * The city the airport is located in.
   */
  city: string;
}

/**
 * Asynchronously retrieves a list of airports near a given location.
 * @param city The city to search for airports near.
 * @returns A promise that resolves to a list of Airport objects.
 */
export async function getAirports(city: string): Promise<Airport[]> {
  // TODO: Implement this by calling an API.

  return [
    {
      code: 'SFO',
      name: 'San Francisco International Airport',
      city: 'San Francisco',
    },
    {
      code: 'SJC',
      name: 'Norman Y. Mineta San Jose International Airport',
      city: 'San Jose',
    },
  ];
}
