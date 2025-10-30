import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/*
  Path that allows for external sources to revalidate.

  A revalidation secret is required to access this route.
  This secret should be set as an environment variable: REVALIDATION_SECRET
  
  Example request body:
  {
    "path": "/some/path",
    "type": "path" // optional, defaults to "path"
    "secret": "your_secret_here"
  }
  If the secret is valid, the endpoint runs 

  revalidatePath(path, type) 
*/
export async function POST(request: NextRequest) {
  try {
    const { path, type, secret } = await request.json();
    // Create a REVALIDATION_SECRET and set it in your environment variables
    if (secret !== process.env.REVALIDATION_SECRET) {
      return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
    }

    if (!path) {
      return NextResponse.json(
        { message: "Path is required" },
        { status: 400 }
      );
    }

    revalidatePath(path, type);

    return NextResponse.json({ revalidated: true });
  } catch (err) {
    console.error("Error revalidating path:", err);
    return NextResponse.json(
      { message: "Error revalidating path" },
      { status: 500 }
    );
  }
}
