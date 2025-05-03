import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { ArrowRight, Car, DollarSign, Leaf } from "lucide-react";
import Image from 'next/image';

// TODO: Replace with actual data fetching from Firestore
const stats = {
  ridesCoordinated: 1250,
  dollarsSaved: 1250 * 50,
  carbonAvoided: 1250 * 15, // Assuming 15kg CO2 per avoided ride
};

// TODO: Replace with actual data fetching from Firestore
const upcomingEvents = [
  { id: 'conf1', name: 'InnovateSphere 2024', attendees: 450, rides: 85, location: 'San Francisco, CA', date: 'Oct 15-17, 2024' },
  { id: 'conf2', name: 'DevConnect Summit', attendees: 800, rides: 120, location: 'Austin, TX', date: 'Nov 5-7, 2024' },
  { id: 'conf3', name: 'FutureTech Expo', attendees: 600, rides: 95, location: 'Miami, FL', date: 'Dec 1-3, 2024' },
];

export default function Home() {
  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary">Welcome to RideThere</h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Coordinate airport rides with fellow event attendees. Save money, reduce emissions, and connect!
        </p>
         <Image
              src="https://picsum.photos/1200/400"
              alt="People sharing a ride"
              width={1200}
              height={400}
              className="rounded-lg shadow-md mx-auto mb-8"
              data-ai-hint="people car sharing happy"
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
              <CardTitle className="text-sm font-medium">Est. Dollars Saved</CardTitle>
              <DollarSign className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.dollarsSaved.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Keeping money in your pocket</p>
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

      {/* Upcoming Events Section */}
      <section>
        <h2 className="text-3xl font-semibold text-center mb-8">Upcoming Events</h2>
        <Card className="shadow-md">
           <CardHeader>
            <CardTitle>Find Your Event</CardTitle>
            <CardDescription>Browse upcoming events and start coordinating your rides.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Attendees</TableHead>
                  <TableHead className="text-right">Rides So Far</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingEvents.map((conf) => (
                  <TableRow key={conf.id}>
                    <TableCell className="font-medium">{conf.name}</TableCell>
                    <TableCell>{conf.location}</TableCell>
                     <TableCell>{conf.date}</TableCell>
                    <TableCell className="text-right">{conf.attendees}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{conf.rides}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/events/${conf.id}`}>
                          View Details <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
