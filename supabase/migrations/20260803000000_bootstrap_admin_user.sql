-- 1. UPDATE EXISTING USER MUBEENAHMA1123@GMAIL.COM TO ADMIN ROLE
UPDATE public.profiles
SET role = 'admin'
WHERE LOWER(email) = 'mubeenahma1123@gmail.com';

-- 2. UPDATE HANDLE_NEW_USER TRIGGER TO AUTOMATICALLY ASSIGN ADMIN ROLE TO MUBEENAHMA1123@GMAIL.COM
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if profile already exists for this user ID
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE 
      WHEN LOWER(NEW.email) = 'mubeenahma1123@gmail.com' THEN 'admin'
      ELSE 'sales'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
