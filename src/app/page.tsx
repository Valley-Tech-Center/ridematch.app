import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { ArrowRight, Car, DollarSign, Leaf } from "lucide-react";
import Image from 'next/image';

// TODO: Replace stats with actual data fetching from Firestore aggregations if possible
const stats = {
  ridesCoordinated: 1250,
  dollarsSaved: 1250 * 50, // Simple estimation
  carbonAvoided: 1250 * 15, // Simple estimation (Assuming 15kg CO2 per avoided ride)
};

// Removed upcomingEvents mock data, as it's fetched on the /events page

export default function Home() {
  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary">Welcome to RideMatch</h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Coordinate airport rides with fellow event attendees. Save money, reduce emissions, and connect!
        </p>
         <Image
              src="/img/car_at_airport.jpg"
              alt="People getting into a car at an airport" // Updated alt text
              width={1200}
              height={400}
              className="rounded-lg shadow-md mx-auto mb-8 object-cover" // Added object-cover
              data-ai-hint="people getting into a car at an airport" // Updated data-ai-hint
              priority // Add priority for LCP image
            />
        <Button asChild size="lg">
          <Link href="/events">
            Find Your Event <ArrowRight className="ml-2" />
          </Link>
        </Button>
      </section>

      {/* Stats Section */}
      <section className="mb-16">
        <h2 className="text-3xl font-semibold text-center mb-8">Our Impact</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rides Coordinated</CardTitle>
              <Car className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.ridesCoordinated.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Making travel easier together</p>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Est. Savings</CardTitle> {/* Changed label */}
              <DollarSign className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.dollarsSaved.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Keeping money in attendees' pockets</p> {/* Updated text */}
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Est. Carbon Avoided</CardTitle>
              <Leaf className="h-5 w-5 text-green-600" /> {/* Specific green for carbon */}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.carbonAvoided.toLocaleString()} kg</div>
              <p className="text-xs text-muted-foreground">Greener trips, happier planet</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How it Works Section (Optional Addition) */}
      <section className="mb-16 bg-secondary/50 py-12 rounded-lg px-6">
          <h2 className="text-3xl font-semibold text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                  <span className="inline-block p-3 bg-primary text-primary-foreground rounded-full mb-3">
                      <span className="text-xl font-bold">1</span>
                  </span>
                  <h3 className="text-xl font-semibold mb-2">Find Your Event</h3>
                  <p className="text-muted-foreground">Browse the list of upcoming events and select yours.</p>
              </div>
              <div>
                  <span className="inline-block p-3 bg-primary text-primary-foreground rounded-full mb-3">
                       <span className="text-xl font-bold">2</span>
                  </span>
                  <h3 className="text-xl font-semibold mb-2">Share Your Flights</h3>
                  <p className="text-muted-foreground">Enter your arrival and departure details securely.</p>
              </div>
              <div>
                   <span className="inline-block p-3 bg-primary text-primary-foreground rounded-full mb-3">
                       <span className="text-xl font-bold">3</span>
                   </span>
                  <h3 className="text-xl font-semibold mb-2">Match & Connect</h3>
                  <p className="text-muted-foreground">See who's traveling around the same time and coordinate a shared ride.</p>
              </div>
          </div>
      </section>


      {/* Call to Action / Events Link Section */}
      <section className="text-center">
        <h2 className="text-3xl font-semibold mb-4">Ready to Coordinate?</h2>
        <p className="text-lg text-muted-foreground mb-8">
          Find your event and start connecting with fellow attendees today.
        </p>
        <Button asChild size="lg">
          <Link href="/events">
            Browse Events <ArrowRight className="ml-2" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
