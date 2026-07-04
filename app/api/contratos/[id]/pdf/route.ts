import { NextResponse } from 'next/server'

export async function GET() {
  return new NextResponse('PDF OK', {
    headers: { 'Content-Type': 'text/plain' }
  })
}
